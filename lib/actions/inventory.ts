'use server';

import { getDb } from './db';
import { RawMaterial, StockTransaction, ProductUnit, RecipeItem } from '@/types/product';
import { cacheDashboardData, getLocalRawMaterials } from '@/lib/storage';

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
