'use server';

import { getDb } from './db';
import { RawMaterial, StockTransaction, ProductUnit, RecipeItem, Supplier, PurchaseOrder, PurchaseOrderItem } from '@/types/product';
import { cacheDashboardData, getLocalRawMaterials } from '@/lib/storage';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetRawMaterials,
  mysqlCreateRawMaterial,
  mysqlUpdateRawMaterial,
  mysqlDeleteRawMaterial,
  mysqlProcessStockTransactions,
  mysqlGetStockTransactions,
  mysqlGetSuppliers,
  mysqlCreateSupplier,
  mysqlUpdateSupplier,
  mysqlDeleteSupplier,
  mysqlGetPurchaseOrders,
  mysqlCreatePurchaseOrder,
  mysqlUpdatePurchaseOrder,
  mysqlDeletePurchaseOrder,
  mysqlGetReplenishmentNotifications,
  mysqlTriggerTestReplenishment,
  mysqlCheckLowStockAndCreateReorders,
  mysqlApprovePurchaseOrder,
  mysqlRejectPurchaseOrder,
  mysqlRecordStockDelivery,
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
    const products = await db.collection('products').find({}).toArray();

    // Map recipes from products into raw materials' linkedProducts
    const linkedMap = new Map<string, any[]>();
    for (const p of products) {
      if (Array.isArray(p.rawMaterials)) {
        for (const r of p.rawMaterials) {
          if (!r.rawMaterialId) continue;
          const list = linkedMap.get(r.rawMaterialId) || [];
          if (!list.some(x => x.productId === p.id)) {
            list.push({
              productId: p.id,
              productName: p.name,
              quantity: Number(r.quantity) || 1,
              unit: r.unit,
            });
            linkedMap.set(r.rawMaterialId, list);
          }
        }
      }
    }
    
    // Save fresh online data straight into SQLite
    await cacheDashboardData('RAWMATERIAL', materials);

    return materials.map(m => {
      const computedLinks = linkedMap.get(m.id || m._id?.toString()) || [];
      const storedLinks = Array.isArray(m.linkedProducts) ? m.linkedProducts : [];
      const combined = [...storedLinks];
      for (const cl of computedLinks) {
        if (!combined.some(x => x.productId === cl.productId)) {
          combined.push(cl);
        }
      }
      return {
        ...m,
        _id: m._id ? m._id.toString() : m.id,
        linkedProducts: combined,
      };
    }) as unknown as RawMaterial[];
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

    // Two-way sync linked products in Mongo
    if (Array.isArray(newMaterial.linkedProducts)) {
      for (const lp of newMaterial.linkedProducts) {
        const prod = await db.collection('products').findOne({ id: lp.productId });
        if (prod) {
          const recipe = Array.isArray(prod.rawMaterials) ? [...prod.rawMaterials] : [];
          const filtered = recipe.filter((r: any) => r.rawMaterialId !== newMaterial.id);
          filtered.push({
            rawMaterialId: newMaterial.id,
            quantity: Number(lp.quantity) || 1,
            unit: lp.unit,
          });
          await db.collection('products').updateOne({ id: lp.productId }, { $set: { rawMaterials: filtered } });
        }
      }
    }
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
    
    // Two-way sync linked products in Mongo
    if (updates.linkedProducts !== undefined) {
      const desiredProductIds = new Set(updates.linkedProducts.map((p: any) => p.productId));
      const allProds = await db.collection('products').find({}).toArray();
      for (const p of allProds) {
        const recipe = Array.isArray(p.rawMaterials) ? [...p.rawMaterials] : [];
        const hadItem = recipe.some((r: any) => r.rawMaterialId === id);
        const shouldHave = desiredProductIds.has(p.id);

        if (shouldHave) {
          const lp = updates.linkedProducts.find((item: any) => item.productId === p.id);
          const filtered = recipe.filter((r: any) => r.rawMaterialId !== id);
          filtered.push({
            rawMaterialId: id,
            quantity: Number(lp?.quantity) || 1,
            unit: lp?.unit || 'kg',
          });
          await db.collection('products').updateOne({ id: p.id }, { $set: { rawMaterials: filtered } });
        } else if (hadItem) {
          const filtered = recipe.filter((r: any) => r.rawMaterialId !== id);
          await db.collection('products').updateOne({ id: p.id }, { $set: { rawMaterials: filtered } });
        }
      }
    }

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

function normalizeUnit(unit: string): string {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'l' || u === 'liter' || u === 'litre' || u === 'liters' || u === 'litres') return 'liter';
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre' || u === 'milliliters' || u === 'millilitres') return 'ml';
  if (u === 'pcs' || u === 'piece' || u === 'pieces' || u === 'pc') return 'piece';
  if (u === 'pkt' || u === 'pack' || u === 'packet' || u === 'packets' || u === 'packs') return 'pack';
  if (u === 'box' || u === 'boxes') return 'box';
  if (u === 'dozen' || u === 'dozens') return 'dozen';
  return u;
}

export async function convertUnit(quantity: number, from: ProductUnit, to: ProductUnit): Promise<number> {
  const normFrom = normalizeUnit(from);
  const normTo = normalizeUnit(to);
  if (normFrom === normTo) return quantity;
  const key = `${normFrom}->${normTo}`;
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

export async function getStockTransactions(rawMaterialId?: string): Promise<StockTransaction[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetStockTransactions(rawMaterialId);
  }
  try {
    const db = await getDb();
    const query = rawMaterialId ? { rawMaterialId } : {};
    const rows = await db.collection('stock_transactions').find(query).sort({ date: -1 }).limit(500).toArray();
    return rows.map((r: any) => ({
      ...r,
      id: r._id ? r._id.toString() : r.id,
      quantityBefore: Number(r.quantityBefore ?? r.quantity_before) || 0,
      quantityChanged: Number(r.quantityChanged ?? r.quantity_changed) || 0,
      quantityAfter: Number(r.quantityAfter ?? r.quantity_after) || 0,
      date: Number(r.date) || Date.now(),
    }));
  } catch (err) {
    console.error('getStockTransactions error:', err);
    return [];
  }
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
      
      // Check for low-stock event and trigger automatic supplier purchase order creation
      for (const tx of txs) {
        const mat = await db.collection('raw_materials').findOne({ id: tx.rawMaterialId });
        if (mat) {
          const cStock = Number(mat.currentStock) || 0;
          const mStock = Number(mat.minimumStock) || 0;
          if (cStock <= mStock) {
            await db.collection('raw_materials').updateOne(
              { id: tx.rawMaterialId },
              { $set: { status: 'Low Stock' } }
            );
          }
        }
      }
      await checkLowStockAndCreateReorders();

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

export async function recordManualStockAdjustment(
  rawMaterialId: string,
  rawMaterialName: string,
  prevStock: number,
  delta: number,
  newStock: number,
  reason: string
): Promise<boolean> {
  const tx: Omit<StockTransaction, 'id' | 'date'> = {
    rawMaterialId,
    rawMaterialName,
    type: 'Manual Adjustment',
    quantityBefore: prevStock,
    quantityChanged: delta,
    quantityAfter: newStock,
    reason,
  };
  return await processStockTransactions([tx]);
}

export async function recordStockDelivery(
  rawMaterialId: string,
  rawMaterialName: string,
  arrivedQty: number,
  orderId: string,
  invoiceNumber?: string
): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlRecordStockDelivery(rawMaterialId, rawMaterialName, arrivedQty, orderId, invoiceNumber);
  }

  try {
    const db = await getDb();
    const mat = await db.collection('raw_materials').findOne({ id: rawMaterialId });
    const prevStock = Number(mat?.currentStock) || 0;
    const newStock = prevStock + arrivedQty;
    const date = Date.now();
    const txId = 'tx_del_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

    await db.collection('raw_materials').updateOne(
      { id: rawMaterialId },
      { $set: { currentStock: newStock, status: 'In Stock' } }
    );

    const tx: StockTransaction = {
      id: txId,
      rawMaterialId,
      rawMaterialName: rawMaterialName || mat?.name || 'Raw Material',
      type: 'Stock Added',
      quantityBefore: prevStock,
      quantityChanged: arrivedQty,
      quantityAfter: newStock,
      date,
      reason: `PO ${orderId} Delivery Received${invoiceNumber ? ` (Inv #${invoiceNumber})` : ''}`,
      referenceId: orderId,
    };

    await db.collection('stock_transactions').insertOne(tx);
    return true;
  } catch (err) {
    console.error('recordStockDelivery error:', err);
    return false;
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

export async function checkLowStockAndCreateReorders(): Promise<{
  createdOrders: PurchaseOrder[];
}> {
  if (isLocalMySqlMode()) {
    return await mysqlCheckLowStockAndCreateReorders();
  }
  try {
    const db = await getDb();
    const lowMaterials = await db.collection('raw_materials').find({
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    }).toArray();

    if (!lowMaterials || lowMaterials.length === 0) {
      return { createdOrders: [] };
    }

    const activePOs = await db.collection('purchase_orders').find({
      state: { $in: ['Pending Approval', 'Approved', 'Pending', 'Ordered'] }
    }).toArray();

    const activeItemIds = new Set<string>();
    const activeItemNames = new Set<string>();
    for (const po of activePOs) {
      if (po.itemsJson) {
        try {
          const items = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : po.itemsJson;
          if (Array.isArray(items)) {
            for (const it of items) {
              if (it.id) activeItemIds.add(it.id);
              if (it.name) activeItemNames.add(it.name.toLowerCase().trim());
            }
          }
        } catch {}
      }
    }

    const suppliers = await db.collection('suppliers').find({}).toArray();
    const createdOrders: PurchaseOrder[] = [];

    for (const mat of lowMaterials) {
      if (activeItemIds.has(mat.id) || activeItemNames.has(mat.name.toLowerCase().trim())) {
        continue; // Prevent duplicate purchase orders for the same low-stock event
      }

      const curStock = Number(mat.currentStock) || 0;
      const minStock = Number(mat.minimumStock) || 0;
      const tgtStock = mat.targetStock != null ? Number(mat.targetStock) : 999;
      const reqQty = parseFloat(Math.max(1, tgtStock - curStock).toFixed(3));

      let sup = suppliers.find((s: any) => (mat.supplierId && s.id === mat.supplierId) || (mat.supplierName && s.name.toLowerCase().trim() === mat.supplierName.toLowerCase().trim()));
      if (!sup && suppliers.length > 0) {
        sup = suppliers[0];
      }

      const supplierId = sup?.id || mat.supplierId || 'unassigned_supplier';
      const supplierName = sup?.name || mat.supplierName || 'General Supplier';
      const unitCost = Number(mat.costPerUnit) || 0;
      const totalAmount = parseFloat((reqQty * unitCost).toFixed(2));

      const itemPayload: PurchaseOrderItem = {
        id: mat.id,
        name: mat.name,
        orderedQty: reqQty,
        unit: mat.unit || 'kg',
        deliveredQty: 0,
        stillOwedQty: reqQty,
        rate: unitCost,
      };

      const newOrder = await createPurchaseOrder({
        id: '',
        supplierId,
        supplierName,
        orderDate: new Date().toISOString().split('T')[0],
        totalAmount,
        paidAmount: 0,
        owedAmount: totalAmount,
        state: 'Pending Approval',
        itemsJson: JSON.stringify([itemPayload]),
        notes: `Auto low-stock replenishment: current stock ${curStock} ${mat.unit}, min threshold ${minStock} ${mat.unit}, target ${tgtStock} ${mat.unit}.`,
      });

      createdOrders.push(newOrder);
      activeItemIds.add(mat.id);
      activeItemNames.add(mat.name.toLowerCase().trim());
    }

    return { createdOrders };
  } catch (err: any) {
    console.error('checkLowStockAndCreateReorders error:', err);
    return { createdOrders: [] };
  }
}

export async function approvePurchaseOrder(orderId: string): Promise<{
  success: boolean;
  order?: PurchaseOrder;
  supplierContact?: { name: string; phone?: string; email?: string };
  messageText?: string;
  whatsappUrl?: string;
  emailUrl?: string;
  error?: string;
}> {
  if (isLocalMySqlMode()) {
    return await mysqlApprovePurchaseOrder(orderId);
  }
  try {
    const db = await getDb();
    const po = await db.collection('purchase_orders').findOne({ id: orderId });
    if (!po) return { success: false, error: 'Purchase order not found.' };

    await db.collection('purchase_orders').updateOne(
      { id: orderId },
      { $set: { state: 'Approved', approvedAt: Date.now() } }
    );

    const sup = await db.collection('suppliers').findOne({ id: po.supplierId });

    let itemsSummary = '';
    try {
      const items = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : po.itemsJson;
      if (Array.isArray(items)) {
        itemsSummary = items.map((it: any) => `• ${it.name}: ${it.orderedQty} ${it.unit || ''} @ ₹${Number(it.rate || 0).toFixed(2)}`).join('\n');
      }
    } catch {}

    const messageText = `*PURCHASE ORDER: ${po.id}*\n` +
      `Hello ${sup?.name || po.supplierName},\n` +
      `Please confirm our purchase order for the following items:\n` +
      (itemsSummary ? `${itemsSummary}\n` : '') +
      `*Total Estimated Amount: ₹${Number(po.totalAmount).toFixed(2)}*\n` +
      `Date: ${new Date(po.orderDate).toLocaleDateString('en-IN')}\n\n` +
      `Please dispatch to our store at your earliest convenience. Thank you!`;

    const rawPhone = sup?.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(messageText)}`
      : undefined;
    const emailUrl = sup?.email
      ? `mailto:${sup.email}?subject=${encodeURIComponent(`Purchase Order ${po.id}`)}&body=${encodeURIComponent(messageText)}`
      : undefined;

    return {
      success: true,
      order: { ...(po as any), state: 'Approved' } as PurchaseOrder,
      supplierContact: sup ? { name: sup.name, phone: sup.phone, email: sup.email } : { name: po.supplierName },
      messageText,
      whatsappUrl,
      emailUrl,
    };
  } catch (err: any) {
    console.error('approvePurchaseOrder error:', err);
    return { success: false, error: err.message || 'Failed to approve order.' };
  }
}

export async function rejectPurchaseOrder(orderId: string, reason?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (isLocalMySqlMode()) {
    return await mysqlRejectPurchaseOrder(orderId, reason);
  }
  try {
    const db = await getDb();
    await db.collection('purchase_orders').updateOne(
      { id: orderId },
      { $set: { state: 'Rejected', rejectedAt: Date.now() } }
    );
    return { success: true };
  } catch (err: any) {
    console.error('rejectPurchaseOrder error:', err);
    return { success: false, error: err.message };
  }
}

export async function getReplenishmentNotifications(): Promise<{
  success: boolean;
  pendingApprovals: any[];
  replenishments: any[];
  lowStockItems: any[];
}> {
  if (isLocalMySqlMode()) {
    return await mysqlGetReplenishmentNotifications();
  }
  try {
    const db = await getDb();
    // Auto check low stock and create pending orders in Mongo mode too
    await checkLowStockAndCreateReorders();

    const pendingPOs = await db
      .collection('purchase_orders')
      .find({ state: { $in: ['Pending Approval', 'Pending'] } })
      .sort({ created_at: -1 })
      .toArray();

    const rmRows = await db.collection('raw_materials').find({}).toArray();
    const rmMap = new Map<string, any>();
    for (const r of rmRows) {
      rmMap.set(r.id, r);
      if (r.name) rmMap.set(r.name.toLowerCase().trim(), r);
    }

    const suppliers = await db.collection('suppliers').find({}).toArray();
    const supMap = new Map<string, any>();
    for (const s of suppliers) {
      supMap.set(s.id, s);
    }

    const pendingApprovals = (pendingPOs || []).map((po: any) => {
      let items: any[] = [];
      try {
        items = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : (po.itemsJson || []);
      } catch {}
      const firstItem = items[0] || {};
      const rm = (firstItem.id && rmMap.get(firstItem.id)) || (firstItem.name && rmMap.get(firstItem.name.toLowerCase().trim())) || {};
      const sup = supMap.get(po.supplierId) || {};

      return {
        id: po.id,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        supplierPhone: sup.phone || null,
        supplierEmail: sup.email || null,
        rawMaterialId: firstItem.id || rm.id || '',
        rawMaterialName: firstItem.name || rm.name || 'Raw Material',
        unit: firstItem.unit || rm.unit || 'kg',
        currentStock: Number(rm.currentStock != null ? rm.currentStock : (rm.stock || 0)),
        minimumStock: Number(rm.minimumStock != null ? rm.minimumStock : (rm.lowStockLimit || 0)),
        targetStock: Number(rm.targetStock != null ? rm.targetStock : 999),
        requiredQuantity: Number(firstItem.orderedQty != null ? firstItem.orderedQty : (Number(firstItem.stillOwedQty) || 1)),
        rate: Number(firstItem.rate || rm.costPerUnit || 0),
        estimatedPurchaseCost: Number(po.totalAmount) || (Number(firstItem.orderedQty || 1) * Number(firstItem.rate || 0)),
        orderDate: po.orderDate || '',
        createdAt: po.createdAt ? new Date(po.createdAt).toISOString() : new Date().toISOString(),
        state: po.state,
      };
    });

    const repRows = await db
      .collection('stock_transactions')
      .find({ type: { $in: ['Auto Replenishment', 'Stock Added'] } })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    const lowRows = await db
      .collection('raw_materials')
      .find({ $expr: { $lte: ['$currentStock', '$minimumStock'] } })
      .sort({ currentStock: 1 })
      .limit(20)
      .toArray();

    return {
      success: true,
      pendingApprovals,
      replenishments: (repRows || []).map((r: any) => ({
        id: r._id?.toString() || r.id,
        rawMaterialId: r.rawMaterialId,
        rawMaterialName: r.rawMaterialName || 'Raw Material',
        unit: r.unit || 'kg',
        quantityBefore: Number(r.quantityBefore) || 0,
        quantityRestored: Number(r.quantityChanged) || 0,
        targetStock: Number(r.quantityAfter) || 999,
        reason: r.reason || '',
        referenceId: r.referenceId || '',
        createdAt: r.createdAt || (r.date ? new Date(r.date).toISOString() : new Date().toISOString()),
        date: Number(r.date) || Date.now(),
      })),
      lowStockItems: (lowRows || []).map((r: any) => ({
        id: r._id?.toString() || r.id,
        name: r.name,
        unit: r.unit || 'kg',
        stock: Number(r.currentStock != null ? r.currentStock : r.stock) || 0,
        lowStockLimit: Number(r.minimumStock != null ? r.minimumStock : r.lowStockLimit) || 0,
        targetStock: Number(r.targetStock) || 999,
        supplierName: r.supplierName || 'Unassigned',
        status: r.status,
        lastReplenishedAt: r.lastReplenishedAt,
      })),
    };
  } catch (err: any) {
    console.error('getReplenishmentNotifications error:', err);
    return { success: false, pendingApprovals: [], replenishments: [], lowStockItems: [] };
  }
}

export async function triggerReplenishment(rawMaterialId?: string): Promise<{
  success: boolean;
  message: string;
  replenishedCount?: number;
}> {
  if (isLocalMySqlMode()) {
    return await mysqlTriggerTestReplenishment(rawMaterialId);
  }
  return { success: false, message: 'Only supported in local mode' };
}
