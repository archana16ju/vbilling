'use server';

import { getDb } from './db';
import { RawMaterial, StockTransaction, ProductUnit, RecipeItem, Supplier, PurchaseOrder } from '@/types/product';
import { cacheDashboardData, getLocalRawMaterials } from '@/lib/storage';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetRawMaterials,
  mysqlCreateRawMaterial,
  mysqlUpdateRawMaterial,
  mysqlDeleteRawMaterial,
  mysqlProcessStockTransactions,
  mysqlGetSuppliers,
  mysqlCreateSupplier,
  mysqlUpdateSupplier,
  mysqlDeleteSupplier,
  mysqlGetPurchaseOrders,
  mysqlCreatePurchaseOrder,
  mysqlUpdatePurchaseOrder,
  mysqlDeletePurchaseOrder,
} from '@/lib/mysql-billing';

const CONVERSION_RATES: Record<string, number> = {
  'kg->g': 1000,
  'g->kg': 0.001,
  'liter->ml': 1000,
  'ml->liter': 0.001,
  'tsp->ml': 5,
  'ml->tsp': 0.2,
  'tbsp->ml': 15,
  'ml->tbsp': 1 / 15,
  'cup->ml': 240,
  'ml->cup': 1 / 240,
  'tbsp->tsp': 3,
  'tsp->tbsp': 1 / 3,
  'cup->tbsp': 16,
  'tbsp->cup': 1 / 16,
  'cup->tsp': 48,
  'tsp->cup': 1 / 48,
};

export async function getRawMaterials(): Promise<RawMaterial[]> {
  if (isLocalMySqlMode()) {
    try {
      return await mysqlGetRawMaterials();
    } catch (err: any) {
      if (err.message && (err.message.includes('currently disabled') || err.message.includes('disabled for this company'))) {
        console.warn('getRawMaterials notice:', err.message);
        return [];
      }
      throw err;
    }
  }
  try {
    const db = await getDb();
    const materials = await db.collection('raw_materials').find({}).toArray();
    
    // Save fresh online data straight into SQLite
    await cacheDashboardData('RAWMATERIAL', materials);

    return materials.map(m => ({
      ...m,
      _id: m._id ? m._id.toString() : m.id,
    })) as unknown as RawMaterial[];
  } catch (err) {
    console.error('getRawMaterials DB error (falling back to local):', err);
    const local = await getLocalRawMaterials();
    return local as unknown as RawMaterial[];
  }
}

export async function createRawMaterial(material: Omit<RawMaterial, 'id'>): Promise<RawMaterial> {
  if (isLocalMySqlMode()) {
    return await mysqlCreateRawMaterial(material);
  }
  const newMaterial = { ...material, id: "rm" + Date.now(), lastUpdated: Date.now() };
  try {
    const db = await getDb();
    await db.collection('raw_materials').insertOne({ ...newMaterial } as any);
    await cacheDashboardData('RAWMATERIAL', [newMaterial]);
  } catch (err) {
    console.error('createRawMaterial error:', err);
    // Offline queue fallback can be implemented similarly to products
    const { addDashboardSyncAction } = await import('@/lib/storage');
    await cacheDashboardData('RAWMATERIAL', [newMaterial]);
    await addDashboardSyncAction('CREATE', 'RAWMATERIAL' as any, newMaterial.id, newMaterial);
  }
  return newMaterial as RawMaterial;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdateRawMaterial(id, updates);
  }
  try {
    updates.lastUpdated = Date.now();
    const db = await getDb();
    const result = await db.collection('raw_materials').updateOne({ id }, { $set: updates });
    
    const existingMaterials = await getLocalRawMaterials();
    const existingMaterial = existingMaterials.find((m: any) => m.id === id);
    if (existingMaterial) {
      await cacheDashboardData('RAWMATERIAL', [{ ...existingMaterial, ...updates }]);
    }
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (err) {
    console.error('updateRawMaterial error:', err);
    const { addDashboardSyncAction } = await import('@/lib/storage');
    const existingMaterials = await getLocalRawMaterials();
    const existingMaterial = existingMaterials.find((m: any) => m.id === id);
    if (existingMaterial) {
      await cacheDashboardData('RAWMATERIAL', [{ ...existingMaterial, ...updates }]);
    }
    await addDashboardSyncAction('UPDATE', 'RAWMATERIAL' as any, id, updates);
    return true;
  }
}

export async function deleteRawMaterial(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeleteRawMaterial(id);
  }
  try {
    const db = await getDb();
    const result = await db.collection('raw_materials').deleteOne({ id });
    return result.deletedCount > 0;
  } catch (err) {
    console.error('deleteRawMaterial error:', err);
    return false;
  }
}

export async function convertUnit(quantity: number, from: ProductUnit, to: ProductUnit): Promise<number> {
  if (from === to) return quantity;
  const key = `${from}->${to}`;
  const rate = CONVERSION_RATES[key];
  if (!rate) {
    throw new Error(`Incompatible unit conversion: ${from} to ${to}`);
  }
  return quantity * rate;
}

export async function calculateRecipeDeduction(recipeItems: RecipeItem[], quantitySold: number, rawMaterials: RawMaterial[]) {
  const deductions: { materialId: string, quantityToDeduct: number, materialUnit: ProductUnit }[] = [];
  
  for (const item of recipeItems) {
    const rm = rawMaterials.find(m => m.id === item.rawMaterialId);
    if (!rm) continue;
    
    // Formula: Required Raw Material = Item Quantity × Quantity Sold
    const requiredInRecipeUnit = item.quantity * quantitySold;
    
    try {
      const requiredInMaterialUnit = await convertUnit(requiredInRecipeUnit, item.unit, rm.unit);
      deductions.push({
        materialId: rm.id,
        quantityToDeduct: requiredInMaterialUnit,
        materialUnit: rm.unit
      });
    } catch (e) {
      console.error('Unit conversion failed during deduction calc:', e);
    }
  }
  return deductions;
}

export async function processStockTransactions(
  transactions: Omit<StockTransaction, 'id' | 'date'>[], 
  isOnline: boolean = true
): Promise<boolean> {
  if (isOnline && isLocalMySqlMode()) {
    return await mysqlProcessStockTransactions(transactions);
  }

  const date = Date.now();
  const txs = transactions.map(t => ({ ...t, id: 'tx' + Math.random().toString(36).substr(2, 9), date })) as StockTransaction[];
  
  if (isOnline) {
    try {
      const db = await getDb();
      for (const tx of txs) {
        await db.collection('raw_materials').updateOne(
          { id: tx.rawMaterialId },
          { $inc: { currentStock: tx.quantityChanged } }
        );
      }
      if (txs.length > 0) {
        await db.collection('stock_transactions').insertMany(txs);
      }
      
      // Sync back to local SQLite
      const updatedMaterials = await db.collection('raw_materials').find({ id: { $in: txs.map(t => t.rawMaterialId) } }).toArray();
      await cacheDashboardData('RAWMATERIAL', updatedMaterials);
      await cacheDashboardData('STOCKTX', txs);
      
      return true;
    } catch (e) {
      console.error('Failed online stock transaction:', e);
      return false;
    }
  } else {
    // Offline mode
    try {
      const { getLocalRawMaterials, cacheDashboardData } = await import('@/lib/storage');
      const localMaterials = await getLocalRawMaterials();
      
      const updatedMaterials = [];
      for (const tx of txs) {
        const material = localMaterials.find((m: any) => m.id === tx.rawMaterialId);
        if (material) {
          material.currentStock += tx.quantityChanged;
          updatedMaterials.push(material);
        }
      }
      await cacheDashboardData('RAWMATERIAL', updatedMaterials);
      await cacheDashboardData('STOCKTX', txs);
      return true;
    } catch (e) {
      console.error('Failed offline stock transaction:', e);
      return false;
    }
  }
}

// --- SUPPLIERS ---
export async function getSuppliers(): Promise<Supplier[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetSuppliers();
  }
  try {
    const db = await getDb();
    const rows = await db.collection('suppliers').find({}).toArray();
    return rows.map((r: any) => ({
      ...r,
      id: r._id ? r._id.toString() : r.id,
    }));
  } catch (err) {
    console.error('getSuppliers DB error:', err);
    return [];
  }
}

export async function createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
  if (isLocalMySqlMode()) {
    return await mysqlCreateSupplier(supplier);
  }
  const newSup = { ...supplier, id: 'sup_' + Date.now() };
  try {
    const db = await getDb();
    await db.collection('suppliers').insertOne({ ...newSup } as any);
  } catch (err) {
    console.error('createSupplier error:', err);
  }
  return newSup;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdateSupplier(id, updates);
  }
  try {
    const db = await getDb();
    const res = await db.collection('suppliers').updateOne({ id }, { $set: updates });
    return res.modifiedCount > 0;
  } catch (err) {
    console.error('updateSupplier error:', err);
    return false;
  }
}

export async function deleteSupplier(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeleteSupplier(id);
  }
  try {
    const db = await getDb();
    const res = await db.collection('suppliers').deleteOne({ id });
    return res.deletedCount > 0;
  } catch (err) {
    console.error('deleteSupplier error:', err);
    return false;
  }
}

// --- PURCHASE ORDERS ---
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetPurchaseOrders();
  }
  try {
    const db = await getDb();
    const rows = await db.collection('purchase_orders').find({}).toArray();
    return rows.map((r: any) => ({
      ...r,
      id: r._id ? r._id.toString() : r.id,
    }));
  } catch (err) {
    console.error('getPurchaseOrders DB error:', err);
    return [];
  }
}

export async function createPurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder> {
  if (isLocalMySqlMode()) {
    return await mysqlCreatePurchaseOrder(order);
  }
  let orderId = order.id?.trim();
  if (!orderId) {
    try {
      const db = await getDb();
      const rows = await db.collection('purchase_orders').find({}).toArray();
      let maxSeq = 0;
      for (const r of rows) {
        const match = (r.id || r._id)?.toString().match(/^PO-(\d+)$/i);
        if (match) {
          const raw = match[1];
          const num = parseInt(raw, 10);
          if (raw.startsWith('0') || num < 1000) {
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
      }
      orderId = `PO-${String(maxSeq + 1).padStart(3, '0')}`;
    } catch {
      orderId = 'PO-001';
    }
  }
  const newOrder = { ...order, id: orderId };
  try {
    const db = await getDb();
    await db.collection('purchase_orders').insertOne({ ...newOrder } as any);
  } catch (err) {
    console.error('createPurchaseOrder error:', err);
  }
  return newOrder;
}

export async function updatePurchaseOrder(
  id: string,
  updates: Partial<PurchaseOrder>
): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdatePurchaseOrder(id, updates);
  }
  try {
    const db = await getDb();
    await db.collection('purchase_orders').updateOne({ id }, { $set: updates });
    return true;
  } catch (err) {
    console.error('updatePurchaseOrder error:', err);
    return false;
  }
}

export async function deletePurchaseOrder(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeletePurchaseOrder(id);
  }
  try {
    const db = await getDb();
    await db.collection('purchase_orders').deleteOne({ id });
    return true;
  } catch (err) {
    console.error('deletePurchaseOrder error:', err);
    return false;
  }
}
