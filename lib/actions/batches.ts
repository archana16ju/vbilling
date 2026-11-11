'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { getDb } from './db';
import { getSession } from '@/lib/auth-session';
import { ProductBatch, BatchTransaction, BatchAllocationResult, BatchStatus } from '@/types/batches';
import {
  mysqlGetProductBatches,
  mysqlCreateProductBatch,
  mysqlUpdateProductBatch,
  mysqlDeleteProductBatch,
  mysqlAllocateFefo,
  mysqlDeductBatchAllocation,
} from '@/lib/mysql-batches';

async function getAuthCompanyId(): Promise<string> {
  const session = await getSession();
  if (!session || !session.companyId) {
    return 'comp_default';
  }
  return session.companyId;
}

export async function getProductBatches(itemId?: string, itemType?: 'product' | 'raw_material'): Promise<ProductBatch[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetProductBatches(itemId, itemType);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const query: any = { companyId };
  if (itemId) query.itemId = itemId;
  if (itemType) query.itemType = itemType;

  const batches = await db.collection('product_batches').find(query).sort({ expiryDate: 1, createdAt: -1 }).toArray();

  const nowStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  return batches.map((b: any) => {
    const batch: ProductBatch = {
      id: b.id || b._id.toString(),
      companyId: b.companyId,
      itemType: b.itemType || 'product',
      itemId: b.itemId,
      itemName: b.itemName,
      itemSku: b.itemSku,
      batchNumber: b.batchNumber,
      manufacturingDate: b.manufacturingDate || null,
      expiryDate: b.expiryDate,
      initialQuantity: Number(b.initialQuantity) || 0,
      currentQuantity: Number(b.currentQuantity) || 0,
      minStockLevel: Number(b.minStockLevel) || 0,
      purchaseCost: Number(b.purchaseCost) || 0,
      sellingPrice: b.sellingPrice != null ? Number(b.sellingPrice) : null,
      supplierId: b.supplierId || null,
      supplierName: b.supplierName || null,
      purchaseOrderId: b.purchaseOrderId || null,
      status: (b.status || 'active') as BatchStatus,
      createdAt: b.createdAt || Date.now(),
      updatedAt: b.updatedAt || Date.now(),
    };

    if (batch.currentQuantity <= 0 && batch.status !== 'quarantined') {
      batch.status = 'exhausted';
    } else if (batch.expiryDate < nowStr && batch.status !== 'quarantined') {
      batch.status = 'expired';
    } else if (batch.expiryDate <= in30Days && batch.status === 'active') {
      batch.status = 'near_expiry';
    }

    return batch;
  });
}

export async function createProductBatch(data: Omit<ProductBatch, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'status'> & { status?: BatchStatus }): Promise<ProductBatch> {
  if (isLocalMySqlMode()) {
    return await mysqlCreateProductBatch(data);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const id = `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const initialQty = Number(data.initialQuantity) || 0;
  const currentQty = data.currentQuantity !== undefined ? Number(data.currentQuantity) : initialQty;
  const nowStr = new Date().toISOString().split('T')[0];

  let status: BatchStatus = data.status || 'active';
  if (data.expiryDate < nowStr) status = 'expired';
  else if (currentQty <= 0) status = 'exhausted';

  const newBatch: ProductBatch = {
    ...data,
    id,
    companyId,
    initialQuantity: initialQty,
    currentQuantity: currentQty,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.collection('product_batches').insertOne(newBatch as any);

  // Inward transaction
  await db.collection('batch_transactions').insertOne({
    id: `btx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId,
    batchId: id,
    transactionType: 'inward',
    quantity: currentQty,
    quantityAfter: currentQty,
    reason: 'Initial Batch Inward',
    createdAt: Date.now(),
  });

  // Set isBatchTracked and synchronize master stock
  if (newBatch.itemType === 'product') {
    await db.collection('products').updateOne(
      { id: newBatch.itemId },
      { $set: { isBatchTracked: true } }
    );
    const sumBatches = await db.collection('product_batches').aggregate([
      { $match: { companyId, itemId: newBatch.itemId, itemType: 'product', status: { $ne: 'quarantined' } } },
      { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
    ]).toArray();
    const totalStock = sumBatches[0]?.total || 0;
    await db.collection('products').updateOne({ id: newBatch.itemId }, { $set: { stock: totalStock } });
  } else {
    const sumBatches = await db.collection('product_batches').aggregate([
      { $match: { companyId, itemId: newBatch.itemId, itemType: 'raw_material', status: { $ne: 'quarantined' } } },
      { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
    ]).toArray();
    const totalStock = sumBatches[0]?.total || 0;
    await db.collection('raw_materials').updateOne({ id: newBatch.itemId }, { $set: { stock: totalStock, currentStock: totalStock } });
  }

  return newBatch;
}

export async function updateProductBatch(id: string, updates: Partial<ProductBatch>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdateProductBatch(id, updates);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const result = await db.collection('product_batches').updateOne(
    { id, companyId },
    { $set: { ...updates, updatedAt: Date.now() } }
  );

  const batch = await db.collection('product_batches').findOne({ id, companyId });
  if (batch) {
    if (batch.itemType === 'product') {
      const sumBatches = await db.collection('product_batches').aggregate([
        { $match: { companyId, itemId: batch.itemId, itemType: 'product', status: { $ne: 'quarantined' } } },
        { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
      ]).toArray();
      const totalStock = sumBatches[0]?.total || 0;
      await db.collection('products').updateOne({ id: batch.itemId }, { $set: { stock: totalStock } });
    } else {
      const sumBatches = await db.collection('product_batches').aggregate([
        { $match: { companyId, itemId: batch.itemId, itemType: 'raw_material', status: { $ne: 'quarantined' } } },
        { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
      ]).toArray();
      const totalStock = sumBatches[0]?.total || 0;
      await db.collection('raw_materials').updateOne({ id: batch.itemId }, { $set: { stock: totalStock, currentStock: totalStock } });
    }
  }

  return result.modifiedCount > 0;
}

export async function deleteProductBatch(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeleteProductBatch(id);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const batch = await db.collection('product_batches').findOne({ id, companyId });
  await db.collection('batch_transactions').deleteMany({ batchId: id, companyId });
  const result = await db.collection('product_batches').deleteOne({ id, companyId });

  if (batch) {
    if (batch.itemType === 'product') {
      const sumBatches = await db.collection('product_batches').aggregate([
        { $match: { companyId, itemId: batch.itemId, itemType: 'product', status: { $ne: 'quarantined' } } },
        { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
      ]).toArray();
      const totalStock = sumBatches[0]?.total || 0;
      await db.collection('products').updateOne({ id: batch.itemId }, { $set: { stock: totalStock } });
    } else {
      const sumBatches = await db.collection('product_batches').aggregate([
        { $match: { companyId, itemId: batch.itemId, itemType: 'raw_material', status: { $ne: 'quarantined' } } },
        { $group: { _id: null, total: { $sum: '$currentQuantity' } } }
      ]).toArray();
      const totalStock = sumBatches[0]?.total || 0;
      await db.collection('raw_materials').updateOne({ id: batch.itemId }, { $set: { stock: totalStock, currentStock: totalStock } });
    }
  }

  return result.deletedCount > 0;
}

export async function getBatchTransactions(batchId?: string): Promise<BatchTransaction[]> {
  if (isLocalMySqlMode()) {
    const { mysqlGetBatchTransactions } = await import('@/lib/mysql-batches');
    return await mysqlGetBatchTransactions(batchId);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const query: any = { companyId };
  if (batchId) query.batchId = batchId;

  const rows = await db.collection('batch_transactions')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return rows.map((r: any) => ({
    id: r.id || r._id.toString(),
    companyId: r.companyId,
    batchId: r.batchId,
    saleId: r.saleId || null,
    transactionType: r.transactionType,
    quantity: Number(r.quantity),
    quantityAfter: Number(r.quantityAfter),
    reason: r.reason || null,
    createdBy: r.createdBy || null,
    createdAt: r.createdAt || Date.now(),
  }));
}

export async function allocateFefo(
  itemId: string,
  quantityNeeded: number,
  itemType: 'product' | 'raw_material' = 'product'
): Promise<BatchAllocationResult> {
  if (isLocalMySqlMode()) {
    return await mysqlAllocateFefo(itemId, quantityNeeded, itemType);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const nowStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const batches = await db.collection('product_batches')
    .find({
      companyId,
      itemId,
      itemType,
      currentQuantity: { $gt: 0 },
      status: { $ne: 'quarantined' },
    })
    .sort({ expiryDate: 1, createdAt: 1 })
    .toArray();

  let remaining = quantityNeeded;
  const allocated: { batchId: string; batchNumber: string; expiryDate: string; quantity: number; sellingPrice?: number | null }[] = [];
  let hasExpired = false;
  let hasNearExpiry = false;

  for (const b of batches) {
    if (b.expiryDate < nowStr) {
      hasExpired = true;
      continue;
    }
    if (b.expiryDate <= in30Days) {
      hasNearExpiry = true;
    }

    if (remaining <= 0) break;

    const available = Number(b.currentQuantity) || 0;
    const toTake = Math.min(available, remaining);
    if (toTake > 0) {
      allocated.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        quantity: toTake,
        sellingPrice: b.sellingPrice != null ? Number(b.sellingPrice) : null,
      });
      remaining -= toTake;
    }
  }

  return {
    allocated,
    unallocatedQuantity: Math.max(0, remaining),
    hasExpiredStock: hasExpired,
    hasNearExpiryStock: hasNearExpiry,
  };
}
