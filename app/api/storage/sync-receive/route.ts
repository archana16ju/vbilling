import { NextResponse } from 'next/server';
import { getDb } from '@/lib/actions/db';

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { bills = [], actions = [] } = body;
    
    let syncedBills = 0;
    let syncedActions = 0;
    const syncedBillIds: string[] = [];

    // Process Bills
    for (const bill of bills) {
      try {
        const saleData = JSON.parse(bill.data);
        const existing = await db.collection('sales').findOne({ $or: [{ id: bill.id }, { _id: bill.id as any }] });
        if (!existing) {
          await db.collection('sales').insertOne({ ...saleData, _id: bill.id as any });
          
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
        syncedBills++;
        syncedBillIds.push(bill.id);
      } catch (e) {
        console.error(`Failed to process received bill ${bill.id}`, e);
      }
    }

    // Process Actions
    for (const action of actions) {
      try {
        const data = JSON.parse(action.data);
        const collection = action.entity_type === 'PRODUCT' ? 'products' : 'categories';

        if (action.action === 'CREATE') {
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
        syncedActions++;
      } catch (e) {
        console.error(`Failed to process received action ${action.id}`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedBills,
      syncedActions,
      syncedBillIds,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
