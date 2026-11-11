import { getMysqlPool, withMySqlTransaction } from './mysql';
import { ensureLocalMySqlInitialized } from './mysql-init';
import { getAuthorizedCompanyContext } from './mysql-company';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ProductBatch, BatchTransaction, BatchAllocationResult, BatchStatus } from '@/types/batches';

function mapRowToBatch(row: any): ProductBatch {
  return {
    id: row.id,
    companyId: row.company_id,
    itemType: row.item_type || 'product',
    itemId: row.item_id,
    itemName: row.item_name || undefined,
    itemSku: row.item_sku || undefined,
    batchNumber: row.batch_number,
    manufacturingDate: row.manufacturing_date ? new Date(row.manufacturing_date).toISOString().split('T')[0] : null,
    expiryDate: row.expiry_date ? new Date(row.expiry_date).toISOString().split('T')[0] : '',
    initialQuantity: Number(row.initial_quantity) || 0,
    currentQuantity: Number(row.current_quantity) || 0,
    minStockLevel: row.min_stock_level != null ? Number(row.min_stock_level) : 0,
    purchaseCost: row.purchase_cost != null ? Number(row.purchase_cost) : 0,
    sellingPrice: row.selling_price != null ? Number(row.selling_price) : null,
    supplierId: row.supplier_id || null,
    supplierName: row.supplier_name || null,
    purchaseOrderId: row.purchase_order_id || null,
    status: (row.status || 'active') as BatchStatus,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function mysqlGetProductBatches(itemId?: string, itemType?: 'product' | 'raw_material'): Promise<ProductBatch[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  let sql = `
    SELECT b.*, 
      CASE 
        WHEN b.item_type = 'product' THEN p.name 
        ELSE rm.name 
      END AS item_name,
      CASE 
        WHEN b.item_type = 'product' THEN p.sku 
        ELSE rm.sku 
      END AS item_sku
    FROM product_batches b
    LEFT JOIN products p ON b.item_type = 'product' AND b.item_id = p.id AND p.company_id = b.company_id
    LEFT JOIN raw_materials rm ON b.item_type = 'raw_material' AND b.item_id = rm.id AND rm.company_id = b.company_id
    WHERE b.company_id = ?
  `;
  const params: any[] = [company.id];

  if (itemId) {
    sql += ' AND b.item_id = ?';
    params.push(itemId);
  }
  if (itemType) {
    sql += ' AND b.item_type = ?';
    params.push(itemType);
  }

  sql += ' ORDER BY b.expiry_date ASC, b.created_at DESC';

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  
  // Recalculate status dynamically based on current date
  const nowStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  return rows.map((r: any) => {
    const batch = mapRowToBatch(r);
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

export async function mysqlCreateProductBatch(data: Omit<ProductBatch, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'status'> & { status?: BatchStatus }): Promise<ProductBatch> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const id = `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const initialQty = Number(data.initialQuantity) || 0;
  const currentQty = data.currentQuantity !== undefined ? Number(data.currentQuantity) : initialQty;
  const nowStr = new Date().toISOString().split('T')[0];
  let status: BatchStatus = data.status || 'active';
  if (data.expiryDate < nowStr) {
    status = 'expired';
  } else if (currentQty <= 0) {
    status = 'exhausted';
  }

  await pool.query<ResultSetHeader>(
    `INSERT INTO product_batches (
      id, company_id, item_type, item_id, batch_number, manufacturing_date, expiry_date,
      initial_quantity, current_quantity, min_stock_level, purchase_cost, selling_price, supplier_id, purchase_order_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      company.id,
      data.itemType || 'product',
      data.itemId,
      data.batchNumber.trim(),
      data.manufacturingDate || null,
      data.expiryDate,
      initialQty,
      currentQty,
      data.minStockLevel || 0,
      data.purchaseCost || 0,
      data.sellingPrice || null,
      data.supplierId || null,
      data.purchaseOrderId || null,
      status,
    ]
  );

  // Record initial inward transaction
  const txId = `btx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await pool.query(
    `INSERT INTO batch_transactions (id, company_id, batch_id, transaction_type, quantity, quantity_after, reason)
     VALUES (?, ?, ?, 'inward', ?, ?, 'Initial Batch Inward')`,
    [txId, company.id, id, currentQty, currentQty]
  );

  // Set is_batch_tracked = 1 on product
  if ((data.itemType || 'product') === 'product') {
    await pool.query('UPDATE products SET is_batch_tracked = 1 WHERE id = ? AND company_id = ?', [data.itemId, company.id]);
    await pool.query(
      `UPDATE products 
       SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'product' AND status != 'quarantined')
       WHERE id = ? AND company_id = ?`,
      [company.id, data.itemId, data.itemId, company.id]
    );
  } else {
    await pool.query(
      `UPDATE raw_materials 
       SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'raw_material' AND status != 'quarantined')
       WHERE id = ? AND company_id = ?`,
      [company.id, data.itemId, data.itemId, company.id]
    );
  }

  return {
    ...data,
    id,
    companyId: company.id,
    status,
    currentQuantity: currentQty,
    initialQuantity: initialQty,
    minStockLevel: data.minStockLevel || 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function mysqlUpdateProductBatch(id: string, updates: Partial<ProductBatch>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const clauses: string[] = [];
  const params: any[] = [];

  if (updates.batchNumber !== undefined) { clauses.push('batch_number = ?'); params.push(updates.batchNumber.trim()); }
  if (updates.manufacturingDate !== undefined) { clauses.push('manufacturing_date = ?'); params.push(updates.manufacturingDate || null); }
  if (updates.expiryDate !== undefined) { clauses.push('expiry_date = ?'); params.push(updates.expiryDate); }
  if (updates.initialQuantity !== undefined) { clauses.push('initial_quantity = ?'); params.push(Number(updates.initialQuantity)); }
  if (updates.currentQuantity !== undefined) { clauses.push('current_quantity = ?'); params.push(Number(updates.currentQuantity)); }
  if (updates.minStockLevel !== undefined) { clauses.push('min_stock_level = ?'); params.push(Number(updates.minStockLevel) || 0); }
  if (updates.purchaseCost !== undefined) { clauses.push('purchase_cost = ?'); params.push(Number(updates.purchaseCost)); }
  if (updates.sellingPrice !== undefined) { clauses.push('selling_price = ?'); params.push(updates.sellingPrice != null ? Number(updates.sellingPrice) : null); }
  if (updates.supplierId !== undefined) { clauses.push('supplier_id = ?'); params.push(updates.supplierId || null); }
  if (updates.status !== undefined) { clauses.push('status = ?'); params.push(updates.status); }

  if (clauses.length === 0) return true;

  params.push(id, company.id);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE product_batches SET ${clauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );

  // Sync master stock
  const [bRows] = await pool.query<RowDataPacket[]>('SELECT item_id, item_type FROM product_batches WHERE id = ? AND company_id = ?', [id, company.id]);
  if (bRows && bRows.length > 0) {
    const item = bRows[0];
    if (item.item_type === 'product') {
      await pool.query(
        `UPDATE products 
         SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'product' AND status != 'quarantined')
         WHERE id = ? AND company_id = ?`,
        [company.id, item.item_id, item.item_id, company.id]
      );
    } else {
      await pool.query(
        `UPDATE raw_materials 
         SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'raw_material' AND status != 'quarantined')
         WHERE id = ? AND company_id = ?`,
        [company.id, item.item_id, item.item_id, company.id]
      );
    }
  }

  return res.affectedRows > 0;
}

export async function mysqlDeleteProductBatch(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const [bRows] = await pool.query<RowDataPacket[]>('SELECT item_id, item_type FROM product_batches WHERE id = ? AND company_id = ?', [id, company.id]);

  await pool.query('DELETE FROM batch_transactions WHERE batch_id = ? AND company_id = ?', [id, company.id]);
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM product_batches WHERE id = ? AND company_id = ?', [id, company.id]);

  if (bRows && bRows.length > 0) {
    const item = bRows[0];
    if (item.item_type === 'product') {
      await pool.query(
        `UPDATE products 
         SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'product' AND status != 'quarantined')
         WHERE id = ? AND company_id = ?`,
        [company.id, item.item_id, item.item_id, company.id]
      );
    } else {
      await pool.query(
        `UPDATE raw_materials 
         SET stock = (SELECT COALESCE(SUM(current_quantity), 0) FROM product_batches WHERE company_id = ? AND item_id = ? AND item_type = 'raw_material' AND status != 'quarantined')
         WHERE id = ? AND company_id = ?`,
        [company.id, item.item_id, item.item_id, company.id]
      );
    }
  }

  return res.affectedRows > 0;
}

export async function mysqlGetBatchTransactions(batchId?: string): Promise<BatchTransaction[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  let sql = `
    SELECT bt.*, pb.batch_number, pb.item_id,
      CASE 
        WHEN pb.item_type = 'product' THEN p.name 
        ELSE rm.name 
      END AS item_name
    FROM batch_transactions bt
    LEFT JOIN product_batches pb ON bt.batch_id = pb.id AND pb.company_id = bt.company_id
    LEFT JOIN products p ON pb.item_type = 'product' AND pb.item_id = p.id AND p.company_id = bt.company_id
    LEFT JOIN raw_materials rm ON pb.item_type = 'raw_material' AND pb.item_id = rm.id AND rm.company_id = bt.company_id
    WHERE bt.company_id = ?
  `;
  const params: any[] = [company.id];
  if (batchId) {
    sql += ' AND bt.batch_id = ?';
    params.push(batchId);
  }
  sql += ' ORDER BY bt.created_at DESC LIMIT 200';

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    batchId: r.batch_id,
    batchNumber: r.batch_number || undefined,
    itemId: r.item_id || undefined,
    itemName: r.item_name || undefined,
    saleId: r.sale_id || null,
    transactionType: r.transaction_type,
    quantity: Number(r.quantity),
    quantityAfter: Number(r.quantity_after),
    reason: r.reason || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}

/**
 * FEFO (First Expired, First Out) batch allocation logic.
 * Sequentially allocates stock from non-expired active batches ordered by expiry_date ASC.
 */
export async function mysqlAllocateFefo(
  itemId: string,
  quantityNeeded: number,
  itemType: 'product' | 'raw_material' = 'product',
  companyIdParam?: string
): Promise<BatchAllocationResult> {
  await ensureLocalMySqlInitialized();
  let companyId = companyIdParam;
  if (!companyId) {
    const comp = await getAuthorizedCompanyContext();
    companyId = comp.id;
  }
  const pool = getMysqlPool();

  const nowStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [batches] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM product_batches 
     WHERE company_id = ? AND item_id = ? AND item_type = ? AND current_quantity > 0 AND status != 'quarantined'
     ORDER BY expiry_date ASC, created_at ASC`,
    [companyId, itemId, itemType]
  );

  let remaining = quantityNeeded;
  const allocated: { batchId: string; batchNumber: string; expiryDate: string; quantity: number; sellingPrice?: number | null }[] = [];
  let hasExpired = false;
  let hasNearExpiry = false;

  for (const b of batches) {
    const exp = b.expiry_date ? new Date(b.expiry_date).toISOString().split('T')[0] : '';
    if (exp < nowStr) {
      hasExpired = true;
      continue; // Skip expired batches from automatic sale allocation
    }
    if (exp <= in30Days) {
      hasNearExpiry = true;
    }

    if (remaining <= 0) break;

    const available = Number(b.current_quantity) || 0;
    const toTake = Math.min(available, remaining);
    if (toTake > 0) {
      allocated.push({
        batchId: b.id,
        batchNumber: b.batch_number,
        expiryDate: exp,
        quantity: toTake,
        sellingPrice: b.selling_price != null ? Number(b.selling_price) : null,
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

/**
 * Deducts quantities from allocated batches in an atomic transaction.
 */
export async function mysqlDeductBatchAllocation(
  allocations: { batchId: string; quantity: number }[],
  saleId: string,
  companyIdParam?: string
): Promise<void> {
  await ensureLocalMySqlInitialized();
  let companyId = companyIdParam;
  if (!companyId) {
    const comp = await getAuthorizedCompanyContext();
    companyId = comp.id;
  }
  const pool = getMysqlPool();

  for (const a of allocations) {
    const [bRows] = await pool.query<RowDataPacket[]>(
      'SELECT current_quantity FROM product_batches WHERE id = ? AND company_id = ? FOR UPDATE',
      [a.batchId, companyId]
    );
    if (!bRows || bRows.length === 0) continue;

    const current = Number(bRows[0].current_quantity) || 0;
    const after = Math.max(0, current - a.quantity);
    const newStatus = after === 0 ? 'exhausted' : undefined;

    if (newStatus) {
      await pool.query(
        'UPDATE product_batches SET current_quantity = ?, status = ? WHERE id = ? AND company_id = ?',
        [after, newStatus, a.batchId, companyId]
      );
    } else {
      await pool.query(
        'UPDATE product_batches SET current_quantity = ? WHERE id = ? AND company_id = ?',
        [after, a.batchId, companyId]
      );
    }

    const txId = `btx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await pool.query(
      `INSERT INTO batch_transactions (id, company_id, batch_id, sale_id, transaction_type, quantity, quantity_after, reason)
       VALUES (?, ?, ?, ?, 'sale_deduction', ?, ?, ?)`,
      [txId, companyId, a.batchId, saleId, -a.quantity, after, `Bill ${saleId}`]
    );
  }
}

/**
 * Automatically synchronizes an item's batch current stock whenever
 * the item's stock is restored, updated, adjusted, or deducted (low / out of stock).
 */
export async function mysqlSyncItemBatchStock(
  itemId: string,
  itemType: 'product' | 'raw_material',
  newStock: number,
  companyId: string,
  conn?: any
): Promise<void> {
  const db = conn || getMysqlPool();
  const safeStock = Math.max(0, Number(newStock) || 0);

  // Find batches for this item
  const [batches]: any = await db.query(
    `SELECT id, current_quantity, expiry_date, status 
     FROM product_batches 
     WHERE company_id = ? AND item_id = ? AND item_type = ? 
     ORDER BY expiry_date ASC, created_at ASC`,
    [companyId, itemId, itemType]
  );

  if (!batches || batches.length === 0) return;

  const nowStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  if (batches.length === 1) {
    const b = batches[0];
    let status = b.status;
    if (safeStock <= 0) {
      status = 'exhausted';
    } else if (b.expiry_date && new Date(b.expiry_date).toISOString().split('T')[0] < nowStr) {
      status = 'expired';
    } else if (b.expiry_date && new Date(b.expiry_date).toISOString().split('T')[0] <= in30Days) {
      status = 'near_expiry';
    } else {
      status = 'active';
    }

    await db.query(
      `UPDATE product_batches 
       SET current_quantity = ?, status = ?, updated_at = NOW() 
       WHERE id = ? AND company_id = ?`,
      [safeStock, status, b.id, companyId]
    );
  } else {
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      let assignedQty = i === 0 ? safeStock : 0;

      let status = b.status;
      if (assignedQty <= 0) {
        status = 'exhausted';
      } else if (b.expiry_date && new Date(b.expiry_date).toISOString().split('T')[0] < nowStr) {
        status = 'expired';
      } else if (b.expiry_date && new Date(b.expiry_date).toISOString().split('T')[0] <= in30Days) {
        status = 'near_expiry';
      } else {
        status = 'active';
      }

      await db.query(
        `UPDATE product_batches 
         SET current_quantity = ?, status = ?, updated_at = NOW() 
         WHERE id = ? AND company_id = ?`,
        [assignedQty, status, b.id, companyId]
      );
    }
  }
}

