import { NextResponse } from 'next/server';
import { 
  getPendingOfflineBills, 
  markOfflineBillSynced, 
  getPendingDashboardActions, 
  removeDashboardAction 
} from '@/lib/storage';
import { getDb } from '@/lib/actions/db';

export async function POST() {
  try {
    // Check if MongoDB is online
    let db;
    try {
      db = await getDb();
    } catch (e) {
      return NextResponse.json({ success: false, message: 'MongoDB is offline' });
    }

    // 1. Sync Offline Bills
    const pendingBills = await getPendingOfflineBills();
    let syncedBills = 0;
    const syncedBillIds: string[] = [];
    
    for (const bill of pendingBills) {
      try {
        const saleData = JSON.parse(bill.data);
        // Ensure idempotency
        const existing = await db.collection('sales').findOne({ $or: [{ id: bill.id }, { _id: bill.id as any }] });
        if (!existing) {
          await db.collection('sales').insertOne({ ...saleData, _id: bill.id as any });
          
          // Decrement stock in MongoDB
          for (const item of saleData.items) {
            await db.collection('products').updateOne(
              { id: item.product.id },
              { $inc: { stock: -item.quantity } }
            );
          }

          if (saleData.paymentMethod === 'Cash') {
            await db.collection('cash_register').insertOne({
              id: 'cr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
              saleId: saleData.id,
              type: 'sale',
              amount: saleData.total,
              amountReceived: saleData.cashReceived || saleData.total,
              changeGiven: saleData.changeReturned || 0,
              timestamp: saleData.timestamp || Date.now()
            });
          }
        }
        
        // Mark as synced locally
        await markOfflineBillSynced(bill.id);
        syncedBills++;
        syncedBillIds.push(bill.id);
      } catch (err) {
        console.error(`Failed to sync bill ${bill.id}`, err);
      }
    }

    // 2. Sync Dashboard Changes
    const pendingActions = await getPendingDashboardActions();
    let syncedActions = 0;

    for (const action of pendingActions) {
      try {
        const data = JSON.parse(action.data);
        const collection = action.entity_type === 'PRODUCT' ? 'products' : 'categories';

        if (action.action === 'CREATE') {
          // Insert, replacing any temporary local ID if needed?
          // We can just keep the 'offline-xxx' ID as the real ID to avoid orphaned references in sales.
          const existing = await db.collection(collection).findOne({ id: action.entity_id });
          if (!existing) {
            await db.collection(collection).insertOne({ ...data, _id: action.entity_id as any });
          }
        } else if (action.action === 'UPDATE') {
          await db.collection(collection).updateOne(
            { $or: [{ id: action.entity_id }, { _id: action.entity_id as any }] },
            { $set: data }
          );
        } else if (action.action === 'DELETE') {
          await db.collection(collection).deleteOne(
            { $or: [{ id: action.entity_id }, { _id: action.entity_id as any }] }
          );
        }

        // Remove from queue
        await removeDashboardAction(action.id);
        syncedActions++;
      } catch (err) {
        console.error(`Failed to sync action ${action.id}`, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedBills,
      syncedActions,
      syncedBillIds,
      message: `Synced ${syncedBills} bills and ${syncedActions} dashboard changes.`
    });

  } catch (e: any) {
    console.error('Sync process failed:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
