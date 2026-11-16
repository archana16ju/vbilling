import mysql from 'mysql2/promise';
import { resolveCompanyPoolAndContext } from './mysql-company';
import { recordAuditLog } from './actions/audit';
import { RowDataPacket } from 'mysql2';

export interface DuplicateDetectionResult {
  hasDuplicate: boolean;
  warningId?: string;
  field?: 'barcode' | 'sku' | 'phone' | 'invoice_number';
  duplicateValue?: string;
  existingRecord?: any;
  reason?: string;
}

/**
 * Normalises a phone number consistently by extracting the last 10 standard digits.
 */
export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Checks for duplicate product Barcode or SKU within the current company.
 */
export async function detectProductDuplicate(
  companyId: string,
  product: { id?: string; barcode?: string; sku?: string; name?: string }
): Promise<DuplicateDetectionResult> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const currentId = product.id || '';

  // 1. Check Barcode duplicate
  const cleanBarcode = (product.barcode || '').trim();
  if (cleanBarcode) {
    // Check in products table
    const [pRows]: any = await pool.query(
      `SELECT id, name, sku, barcode, price, stock 
       FROM products 
       WHERE company_id = ? AND barcode = ? AND id != ? LIMIT 1`,
      [company.id, cleanBarcode, currentId]
    );

    // Also check product_barcodes table
    let existingBarcodeProd: any = pRows?.[0] || null;
    if (!existingBarcodeProd) {
      const [pbRows]: any = await pool.query(
        `SELECT pb.product_id as id, p.name, p.sku, pb.barcode, p.price, p.stock 
         FROM product_barcodes pb
         JOIN products p ON p.id = pb.product_id AND p.company_id = pb.company_id
         WHERE pb.company_id = ? AND pb.barcode = ? AND pb.product_id != ? LIMIT 1`,
        [company.id, cleanBarcode, currentId]
      );
      if (pbRows && pbRows.length > 0) {
        existingBarcodeProd = pbRows[0];
      }
    }

    if (existingBarcodeProd) {
      const reason = `Barcode "${cleanBarcode}" is already assigned to product "${existingBarcodeProd.name}" (SKU: ${existingBarcodeProd.sku || 'N/A'}, ID: ${existingBarcodeProd.id})`;
      const warningId = await recordDuplicateWarning({
        companyId: company.id,
        entityType: 'product',
        fieldName: 'barcode',
        duplicateValue: cleanBarcode,
        recordId: currentId || null,
        existingRecordId: existingBarcodeProd.id,
        reason,
      });

      return {
        hasDuplicate: true,
        warningId,
        field: 'barcode',
        duplicateValue: cleanBarcode,
        existingRecord: existingBarcodeProd,
        reason,
      };
    }
  }

  // 2. Check SKU duplicate
  const cleanSku = (product.sku || '').trim().toUpperCase();
  if (cleanSku) {
    const [sRows]: any = await pool.query(
      `SELECT id, name, sku, barcode, price, stock 
       FROM products 
       WHERE company_id = ? AND UPPER(sku) = ? AND id != ? LIMIT 1`,
      [company.id, cleanSku, currentId]
    );

    if (sRows && sRows.length > 0) {
      const existingSkuProd = sRows[0];
      const reason = `SKU "${cleanSku}" is already assigned to product "${existingSkuProd.name}" (ID: ${existingSkuProd.id})`;
      const warningId = await recordDuplicateWarning({
        companyId: company.id,
        entityType: 'product',
        fieldName: 'sku',
        duplicateValue: cleanSku,
        recordId: currentId || null,
        existingRecordId: existingSkuProd.id,
        reason,
      });

      return {
        hasDuplicate: true,
        warningId,
        field: 'sku',
        duplicateValue: cleanSku,
        existingRecord: existingSkuProd,
        reason,
      };
    }
  }

  return { hasDuplicate: false };
}

/**
 * Checks for duplicate customer Phone Number within the current company.
 */
export async function detectCustomerDuplicate(
  companyId: string,
  customer: { id?: string; phone?: string; name?: string }
): Promise<DuplicateDetectionResult> {
  const cleanNormalized = normalizePhoneNumber(customer.phone);
  if (!cleanNormalized) return { hasDuplicate: false };

  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const currentId = customer.id || '';

  const [rows]: any = await pool.query(
    `SELECT id, name, phone, email, address, loyalty_tier, loyalty_points_balance 
     FROM customers 
     WHERE company_id = ? 
       AND RIGHT(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), 10) = ? 
       AND id != ? LIMIT 1`,
    [company.id, cleanNormalized, currentId]
  );

  if (rows && rows.length > 0) {
    const existing = rows[0];
    const reason = `Phone number "${customer.phone}" matches existing customer "${existing.name}" (Phone: ${existing.phone}, ID: ${existing.id})`;
    const warningId = await recordDuplicateWarning({
      companyId: company.id,
      entityType: 'customer',
      fieldName: 'phone',
      duplicateValue: customer.phone || cleanNormalized,
      recordId: currentId || null,
      existingRecordId: existing.id,
      reason,
    });

    return {
      hasDuplicate: true,
      warningId,
      field: 'phone',
      duplicateValue: customer.phone || cleanNormalized,
      existingRecord: existing,
      reason,
    };
  }

  return { hasDuplicate: false };
}

/**
 * Checks for duplicate Invoice Number within the current company and branch.
 */
export async function detectInvoiceDuplicate(
  companyId: string,
  billNumber: string,
  branchId?: string | null,
  currentSaleId?: string
): Promise<DuplicateDetectionResult> {
  const cleanBill = (billNumber || '').trim();
  if (!cleanBill) return { hasDuplicate: false };

  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const currentId = currentSaleId || '';

  let query = `SELECT id, bill_number, total, payment_status, created_at, customer_name FROM sales WHERE company_id = ? AND bill_number = ? AND id != ?`;
  const params: any[] = [company.id, cleanBill, currentId];

  query += ` LIMIT 1`;
  const [rows]: any = await pool.query(query, params);

  if (rows && rows.length > 0) {
    const existing = rows[0];
    const reason = `Invoice number "${cleanBill}" was already recorded on ${new Date(existing.created_at).toLocaleDateString()} (Total: ₹${existing.total}, ID: ${existing.id})`;
    const warningId = await recordDuplicateWarning({
      companyId: company.id,
      branchId: branchId || null,
      entityType: 'invoice',
      fieldName: 'invoice_number',
      duplicateValue: cleanBill,
      recordId: currentId || null,
      existingRecordId: existing.id,
      reason,
    });

    return {
      hasDuplicate: true,
      warningId,
      field: 'invoice_number',
      duplicateValue: cleanBill,
      existingRecord: existing,
      reason,
    };
  }

  return { hasDuplicate: false };
}

/**
 * Records a duplicate warning in the company database, preventing repeated warnings
 * for the exact same unresolved duplicate item.
 */
async function recordDuplicateWarning(entry: {
  companyId: string;
  branchId?: string | null;
  entityType: 'product' | 'customer' | 'invoice';
  fieldName: 'barcode' | 'sku' | 'phone' | 'invoice_number';
  duplicateValue: string;
  recordId?: string | null;
  existingRecordId: string;
  reason: string;
}): Promise<string> {
  const { pool, company } = await resolveCompanyPoolAndContext(entry.companyId);

  // Check if an unresolved warning already exists for this value to avoid spamming admins
  const [existing]: any = await pool.query(
    `SELECT id FROM duplicate_warnings 
     WHERE company_id = ? AND entity_type = ? AND field_name = ? AND duplicate_value = ? AND status = 'unresolved' LIMIT 1`,
    [company.id, entry.entityType, entry.fieldName, entry.duplicateValue]
  );

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const id = `dup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pool.query(
    `INSERT INTO duplicate_warnings (
      id, company_id, branch_id, entity_type, field_name, duplicate_value,
      record_id, existing_record_id, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', NOW())`,
    [
      id,
      company.id,
      entry.branchId || null,
      entry.entityType,
      entry.fieldName,
      entry.duplicateValue,
      entry.recordId || null,
      entry.existingRecordId,
      entry.reason,
    ]
  );

  return id;
}

/**
 * Retrieves active duplicate warnings for a company.
 */
export async function getDuplicateWarnings(
  companyId: string,
  status: 'unresolved' | 'resolved' | 'dismissed' | 'all' = 'unresolved'
): Promise<any[]> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  let query = `SELECT * FROM duplicate_warnings WHERE company_id = ?`;
  const params: any[] = [company.id];

  if (status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;
  const [rows]: any = await pool.query(query, params);
  return rows;
}

/**
 * Resolves or dismisses a duplicate warning and records the action in Audit Log.
 */
export async function resolveDuplicateWarning(
  companyId: string,
  warningId: string,
  resolution: {
    status: 'resolved' | 'dismissed';
    action: string;
    notes?: string;
    resolvedBy: string;
  }
): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [warnings]: any = await pool.query(
    `SELECT * FROM duplicate_warnings WHERE id = ? AND company_id = ? LIMIT 1`,
    [warningId, company.id]
  );

  if (!warnings || warnings.length === 0) return false;
  const warning = warnings[0];

  await pool.query(
    `UPDATE duplicate_warnings 
     SET status = ?, resolved_action = ?, resolution_notes = ?, resolved_by = ?, resolved_at = NOW() 
     WHERE id = ? AND company_id = ?`,
    [resolution.status, resolution.action, resolution.notes || null, resolution.resolvedBy, warningId, company.id]
  );

  // Record in Universal Audit Log
  await recordAuditLog({
    companyId: company.id,
    userId: resolution.resolvedBy,
    action: 'DUPLICATE_WARNING_RESOLVED',
    entityType: 'DUPLICATE_WARNING',
    entityId: warningId,
    details: {
      warningId,
      entityType: warning.entity_type,
      fieldName: warning.field_name,
      duplicateValue: warning.duplicate_value,
      existingRecordId: warning.existing_record_id,
      resolutionStatus: resolution.status,
      resolutionAction: resolution.action,
      notes: resolution.notes,
      resolvedBy: resolution.resolvedBy,
    },
  });

  return true;
}
