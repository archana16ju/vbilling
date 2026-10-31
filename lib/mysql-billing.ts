import { getMysqlPool, withMySqlTransaction } from './mysql';
import { ensureLocalMySqlInitialized } from './mysql-init';
import { getAuthorizedCompanyContext } from './mysql-company';
import { assertCompanyModuleEnabled } from './company-permissions';
import { Product, Category, PRODUCTS, CATEGORIES } from '@/lib/mock-data';
import { RawMaterial, StockTransaction, Supplier, PurchaseOrder } from '@/types/product';
import { Delivery, DeliveryPerson, DeliveryStatus, AssignmentStatus, AvailabilityStatus, OnlineOrderConfig } from '@/types/delivery';
export type { Delivery, DeliveryPerson, DeliveryStatus, AssignmentStatus, AvailabilityStatus, OnlineOrderConfig };
import { calculateRecipeDeduction } from '@/lib/actions/inventory';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { getSession } from './auth-session';
import { TaxItem, ChargeItem, DEFAULT_TAXES, DEFAULT_CHARGES } from '@/types/taxes-charges';
import { WhatsAppSettings, DEFAULT_WHATSAPP_SETTINGS } from '@/types/whatsapp';
export type { WhatsAppSettings };

// Helper to convert database row to Product
function mapRowToProduct(row: any): Product {
  let rawMaterials = undefined;
  if (row.raw_materials_json) {
    try {
      rawMaterials = typeof row.raw_materials_json === 'string'
        ? JSON.parse(row.raw_materials_json)
        : row.raw_materials_json;
    } catch {
      rawMaterials = undefined;
    }
  }

  const prod: Product & { recipeYield?: number; recipeUnit?: string; companyId?: string } = {
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    barcode: row.barcode || '',
    price: Number(row.price) || 0,
    stock: Number(row.stock) || 0,
    unit: row.unit || 'plate',
    quantityStep: Number(row.quantity_step) || 1,
    categoryId: row.category_id || 'all',
    image: row.image || undefined,
    tax: Number(row.tax) || 0,
    discount: Number(row.discount) || 0,
    recipeYield: row.recipe_yield != null ? Number(row.recipe_yield) : undefined,
    recipeUnit: row.recipe_unit || undefined,
    rawMaterials,
  };
  return prod as Product;
}

// Helper to convert database row to RawMaterial
function mapRowToRawMaterial(row: any): RawMaterial {
  const mat: RawMaterial & { sku?: string } = {
    id: row.id,
    name: row.name,
    sku: row.sku || undefined,
    category: row.category || undefined,
    unit: row.unit || 'kg',
    purchaseUnit: row.purchase_unit || undefined,
    conversionFactor: row.conversion_factor != null ? Number(row.conversion_factor) : 1,
    currentStock: Number(row.stock) || 0,
    minimumStock: Number(row.low_stock_limit) || 0,
    supplierName: row.supplier_name || undefined,
    shelfLifeDays: row.shelf_life_days != null ? Number(row.shelf_life_days) : undefined,
    costPerUnit: row.cost_per_unit != null ? Number(row.cost_per_unit) : 0,
    isActive: true,
    lastUpdated: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
  return mat as RawMaterial;
}

// Helper to convert database row to DeliveryPerson
function mapRowToDeliveryPerson(row: any): DeliveryPerson {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    employeeId: row.employee_id,
    phone: row.phone,
    isActive: Boolean(row.is_active),
    availabilityStatus: (row.availability_status || 'available') as AvailabilityStatus,
    assignedDeliveryCount: Number(row.assigned_delivery_count) || 0,
    maxActiveDeliveries: Number(row.max_active_deliveries) || 3,
    lastAssignedAt: row.last_assigned_at ? new Date(row.last_assigned_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Helper to convert database row to Delivery
function mapRowToDelivery(row: any): Delivery {
  let statusHistory = null;
  if (row.status_history) {
    try {
      statusHistory = typeof row.status_history === 'string' ? JSON.parse(row.status_history) : row.status_history;
    } catch {
      statusHistory = null;
    }
  }

  let items = undefined;
  if (row.sale_items) {
    try {
      items = typeof row.sale_items === 'string' ? JSON.parse(row.sale_items) : row.sale_items;
    } catch {
      items = undefined;
    }
  }

  return {
    id: row.id,
    companyId: row.company_id,
    billId: row.bill_id,
    orderSource: row.order_source || 'Terminal',
    onlineOrderId: row.online_order_id || null,
    trackingToken: row.tracking_token || null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    deliveryPersonId: row.delivery_person_id || null,
    deliveryPersonName: row.delivery_person_name || null,
    deliveryPersonPhone: row.delivery_person_phone || null,
    deliveryStatus: (row.delivery_status || 'pending') as DeliveryStatus,
    assignmentStatus: (row.assignment_status || 'unassigned') as AssignmentStatus,
    orderTime: row.order_time ? new Date(row.order_time).getTime() : Date.now(),
    assignedAt: row.assigned_at ? new Date(row.assigned_at).getTime() : null,
    pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at).getTime() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    deliveryNotes: row.delivery_notes || null,
    statusHistory,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    locationUpdatedAt: row.location_updated_at ? new Date(row.location_updated_at).getTime() : null,
    items,
    totalAmount: row.sale_total != null ? Number(row.sale_total) : undefined,
    paymentMethod: row.sale_payment_method || undefined,
    paymentStatus: row.sale_payment_status || undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Helper to convert database row to OnlineOrderConfig
function mapRowToOnlineOrderConfig(row: any): OnlineOrderConfig {
  return {
    id: row.id,
    companyId: row.company_id,
    platform: row.platform,
    displayName: row.display_name,
    isEnabled: Boolean(row.is_enabled),
    apiKey: row.api_key || null,
    apiSecret: row.api_secret || null,
    storeId: row.store_id || null,
    webhookSecret: row.webhook_secret || null,
    autoAccept: Boolean(row.auto_accept),
    connectionStatus: (row.connection_status || 'disconnected') as any,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Helper to convert database row to Sale
function mapRowToSale(row: any) {
  let items = [];
  try {
    items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
  } catch {
    items = [];
  }

  const timestamp = row.created_at ? new Date(row.created_at).getTime() : Date.now();

  const delivery = row.delivery_id ? {
    id: row.delivery_id,
    deliveryStatus: row.delivery_status || 'pending',
    assignmentStatus: row.assignment_status || 'unassigned',
    deliveryAddress: row.delivery_address || undefined,
    deliveryNotes: row.delivery_notes || undefined,
    deliveryPersonName: row.delivery_person_name || undefined,
    deliveryPersonPhone: row.delivery_person_phone || undefined,
    orderSource: row.delivery_order_source || row.order_source || 'Terminal',
    onlineOrderId: row.delivery_online_order_id || row.online_order_id || undefined,
    trackingToken: row.tracking_token || undefined,
  } : undefined;

  return {
    id: row.bill_number || row.id,
    _id: row.id,
    billNumber: row.bill_number,
    companyId: row.company_id,
    items,
    subtotal: Number(row.subtotal) || 0,
    discount: Number(row.discount) || 0,
    tax: Number(row.tax) || 0,
    cgst: (Number(row.tax) || 0) / 2,
    sgst: (Number(row.tax) || 0) / 2,
    roundOff: Number(row.round_off) || 0,
    total: Number(row.total) || 0,
    paymentMethod: row.payment_method || 'Cash',
    paymentStatus: row.payment_status || 'paid',
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    tableId: row.table_id || undefined,
    tableName: row.table_name || undefined,
    waiterId: row.waiter_id || undefined,
    waiterName: row.waiter_name || undefined,
    servingStatus: row.serving_status || undefined,
    orderType: row.order_type || 'Dine In',
    orderSource: row.order_source || 'Terminal',
    onlineOrderId: row.online_order_id || undefined,
    orderNote: row.order_note || undefined,
    createdBy: row.created_by || 'Cashier',
    companyName: row.company_name || undefined,
    delivery,
    timestamp,
    syncStatus: 'COMPLETED' as const,
  };
}

// --- PRODUCTS ---
export async function mysqlGetProducts(): Promise<Product[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'products');
  const pool = getMysqlPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, sku, barcode, price, stock, unit, quantity_step, category_id, company_id,
              image, tax, discount, recipe_yield, recipe_unit, raw_materials_json 
       FROM products 
       WHERE company_id = ? 
       ORDER BY name ASC`,
      [company.id]
    );

    if (!rows || rows.length === 0) {
      return [];
    }

    const mapped = rows.map(mapRowToProduct);
    return mapped;
  } catch (err: any) {
    console.error('mysqlGetProducts error:', err.message);
    throw err;
  }
}

export async function mysqlCreateProduct(product: Omit<Product, 'id'>): Promise<Product> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'products');
  const pool = getMysqlPool();
  const newProduct: Product = { ...product, id: 'p' + Date.now() };

  await pool.query<ResultSetHeader>(
    `INSERT INTO products (
      id, company_id, name, sku, barcode, price, stock, unit, quantity_step, category_id, 
      image, tax, discount, recipe_yield, recipe_unit, raw_materials_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newProduct.id,
      company.id,
      newProduct.name,
      newProduct.sku || null,
      newProduct.barcode || null,
      newProduct.price || 0,
      newProduct.stock || 0,
      newProduct.unit || 'plate',
      newProduct.quantityStep || 1,
      newProduct.categoryId || 'all',
      newProduct.image || null,
      (newProduct as any).tax || 0,
      (newProduct as any).discount || 0,
      (newProduct as any).recipeYield ?? null,
      (newProduct as any).recipeUnit || null,
      newProduct.rawMaterials ? JSON.stringify(newProduct.rawMaterials) : null,
    ]
  );

  return newProduct;
}

export async function mysqlUpdateProduct(id: string, updates: Partial<Product>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'products');
  const pool = getMysqlPool();
  const setClauses: string[] = [];
  const params: any[] = [];
  const u = updates as any;

  if (u.name !== undefined) { setClauses.push('name = ?'); params.push(u.name); }
  if (u.sku !== undefined) { setClauses.push('sku = ?'); params.push(u.sku); }
  if (u.barcode !== undefined) { setClauses.push('barcode = ?'); params.push(u.barcode); }
  if (u.price !== undefined) { setClauses.push('price = ?'); params.push(u.price); }
  if (u.stock !== undefined) { setClauses.push('stock = ?'); params.push(u.stock); }
  if (u.unit !== undefined) { setClauses.push('unit = ?'); params.push(u.unit); }
  if (u.quantityStep !== undefined) { setClauses.push('quantity_step = ?'); params.push(u.quantityStep); }
  if (u.categoryId !== undefined) { setClauses.push('category_id = ?'); params.push(u.categoryId); }
  if (u.image !== undefined) { setClauses.push('image = ?'); params.push(u.image); }
  if (u.tax !== undefined) { setClauses.push('tax = ?'); params.push(u.tax); }
  if (u.discount !== undefined) { setClauses.push('discount = ?'); params.push(u.discount); }
  if (u.recipeYield !== undefined) { setClauses.push('recipe_yield = ?'); params.push(u.recipeYield); }
  if (u.recipeUnit !== undefined) { setClauses.push('recipe_unit = ?'); params.push(u.recipeUnit); }
  if (u.rawMaterials !== undefined) {
    setClauses.push('raw_materials_json = ?');
    params.push(u.rawMaterials ? JSON.stringify(u.rawMaterials) : null);
  }

  if (setClauses.length === 0) return true;

  params.push(id);
  params.push(company.id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );

  return result.affectedRows > 0;
}

export async function mysqlDeleteProduct(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'products');
  const pool = getMysqlPool();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM products WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return result.affectedRows > 0;
}

// --- CATEGORIES ---
export async function mysqlGetCategories(): Promise<Category[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'categories');
  const pool = getMysqlPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, image, company_id FROM categories WHERE company_id = ? ORDER BY name ASC',
      [company.id]
    );

    if (!rows || rows.length === 0) {
      return [];
    }

    const mapped: Category[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image || undefined,
    }));

    return mapped;
  } catch (err: any) {
    console.error('mysqlGetCategories error:', err.message);
    throw err;
  }
}

export async function mysqlCreateCategory(category: Omit<Category, 'id'>): Promise<Category> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'categories');
  const pool = getMysqlPool();
  const newCat: Category = { ...category, id: 'c' + Date.now() };

  await pool.query<ResultSetHeader>(
    'INSERT INTO categories (id, company_id, name, image) VALUES (?, ?, ?, ?)',
    [newCat.id, company.id, newCat.name, newCat.image || null]
  );

  return newCat;
}

export async function mysqlUpdateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'categories');
  const pool = getMysqlPool();
  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
  if (updates.image !== undefined) { setClauses.push('image = ?'); params.push(updates.image); }

  if (setClauses.length === 0) return true;

  params.push(id);
  params.push(company.id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );

  return result.affectedRows > 0;
}

export async function mysqlDeleteCategory(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'categories');
  const pool = getMysqlPool();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM categories WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return result.affectedRows > 0;
}

// --- RAW MATERIALS ---
export async function mysqlGetRawMaterials(): Promise<RawMaterial[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'inventory');
  const pool = getMysqlPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, company_id, name, category, sku, unit, purchase_unit, conversion_factor, stock, cost_per_unit, supplier_name, shelf_life_days, low_stock_limit, created_at, updated_at 
       FROM raw_materials 
       WHERE company_id = ? 
       ORDER BY name ASC`,
      [company.id]
    );

    const mapped = rows.map(mapRowToRawMaterial);
    return mapped;
  } catch (err: any) {
    console.error('mysqlGetRawMaterials error:', err.message);
    throw err;
  }
}

export async function mysqlCreateRawMaterial(material: Omit<RawMaterial, 'id'>): Promise<RawMaterial> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'inventory');
  const pool = getMysqlPool();
  const newMaterial: RawMaterial = {
    ...material,
    id: 'rm' + Date.now(),
    lastUpdated: Date.now(),
  };

  await pool.query<ResultSetHeader>(
    `INSERT INTO raw_materials (id, company_id, name, category, sku, unit, purchase_unit, conversion_factor, stock, cost_per_unit, supplier_name, shelf_life_days, low_stock_limit) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newMaterial.id,
      company.id,
      newMaterial.name,
      newMaterial.category || null,
      (newMaterial as any).sku || null,
      newMaterial.unit,
      newMaterial.purchaseUnit || null,
      newMaterial.conversionFactor ?? 1,
      newMaterial.currentStock || 0,
      newMaterial.costPerUnit || 0,
      newMaterial.supplierName || null,
      newMaterial.shelfLifeDays || null,
      newMaterial.minimumStock || 0,
    ]
  );

  return newMaterial;
}

export async function mysqlUpdateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'inventory');
  const pool = getMysqlPool();
  const setClauses: string[] = [];
  const params: any[] = [];
  const u = updates as any;

  if (u.name !== undefined) { setClauses.push('name = ?'); params.push(u.name); }
  if (u.category !== undefined) { setClauses.push('category = ?'); params.push(u.category); }
  if (u.sku !== undefined) { setClauses.push('sku = ?'); params.push(u.sku); }
  if (u.unit !== undefined) { setClauses.push('unit = ?'); params.push(u.unit); }
  if (u.purchaseUnit !== undefined) { setClauses.push('purchase_unit = ?'); params.push(u.purchaseUnit); }
  if (u.conversionFactor !== undefined) { setClauses.push('conversion_factor = ?'); params.push(u.conversionFactor); }
  if (u.currentStock !== undefined) { setClauses.push('stock = ?'); params.push(u.currentStock); }
  if (u.minimumStock !== undefined) { setClauses.push('low_stock_limit = ?'); params.push(u.minimumStock); }
  if (u.supplierName !== undefined) { setClauses.push('supplier_name = ?'); params.push(u.supplierName); }
  if (u.shelfLifeDays !== undefined) { setClauses.push('shelf_life_days = ?'); params.push(u.shelfLifeDays); }
  if (u.costPerUnit !== undefined) { setClauses.push('cost_per_unit = ?'); params.push(u.costPerUnit); }

  if (setClauses.length === 0) return true;

  params.push(id);
  params.push(company.id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE raw_materials SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );

  return result.affectedRows > 0;
}

export async function mysqlDeleteRawMaterial(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'inventory');
  const pool = getMysqlPool();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM raw_materials WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return result.affectedRows > 0;
}

// --- SUPPLIERS ---
export async function mysqlGetSuppliers(): Promise<Supplier[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, company_id, name, phone, email, address, balance_owed, created_at, updated_at FROM suppliers WHERE company_id = ? ORDER BY name ASC',
    [company.id]
  );
  return rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    phone: r.phone || undefined,
    email: r.email || undefined,
    address: r.address || undefined,
    balanceOwed: Number(r.balance_owed) || 0,
  }));
}

export async function mysqlCreateSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const newSupplier: Supplier = {
    ...supplier,
    id: 'sup_' + Date.now(),
    companyId: company.id,
    balanceOwed: supplier.balanceOwed || 0,
  };
  await pool.query<ResultSetHeader>(
    'INSERT INTO suppliers (id, company_id, name, phone, email, address, balance_owed) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      newSupplier.id,
      company.id,
      newSupplier.name,
      newSupplier.phone || null,
      newSupplier.email || null,
      newSupplier.address || null,
      newSupplier.balanceOwed || 0,
    ]
  );
  return newSupplier;
}

export async function mysqlUpdateSupplier(id: string, updates: Partial<Supplier>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const setClauses: string[] = [];
  const params: any[] = [];
  if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
  if (updates.phone !== undefined) { setClauses.push('phone = ?'); params.push(updates.phone); }
  if (updates.email !== undefined) { setClauses.push('email = ?'); params.push(updates.email); }
  if (updates.address !== undefined) { setClauses.push('address = ?'); params.push(updates.address); }
  if (updates.balanceOwed !== undefined) { setClauses.push('balance_owed = ?'); params.push(updates.balanceOwed); }
  if (setClauses.length === 0) return true;
  params.push(id, company.id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function mysqlDeleteSupplier(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM suppliers WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return result.affectedRows > 0;
}

// --- PURCHASE ORDERS ---
export async function mysqlGetPurchaseOrders(): Promise<PurchaseOrder[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, company_id, supplier_id, supplier_name, order_date, total_amount, paid_amount, owed_amount, state, items_json, created_at FROM purchase_orders WHERE company_id = ? ORDER BY order_date DESC',
    [company.id]
  );
  return rows.map((r: any) => ({
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    orderDate: r.order_date ? new Date(r.order_date).toISOString().split('T')[0] : '',
    totalAmount: Number(r.total_amount) || 0,
    paidAmount: Number(r.paid_amount) || 0,
    owedAmount: Number(r.owed_amount) || 0,
    state: r.state || 'Delivered',
    itemsJson: r.items_json || undefined,
  }));
}

export async function mysqlCreatePurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  let orderId = order.id?.trim();
  if (!orderId) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM purchase_orders WHERE company_id = ?',
      [company.id]
    );
    let maxSeq = 0;
    for (const r of rows) {
      const match = r.id?.match(/^PO-(\d+)$/i);
      if (match) {
        const raw = match[1];
        const num = parseInt(raw, 10);
        if (raw.startsWith('0') || num < 1000) {
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    }
    orderId = `PO-${String(maxSeq + 1).padStart(3, '0')}`;
  }

  const newOrder: PurchaseOrder = {
    ...order,
    id: orderId,
  };
  await pool.query<ResultSetHeader>(
    `INSERT INTO purchase_orders (id, company_id, supplier_id, supplier_name, order_date, total_amount, paid_amount, owed_amount, state, items_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newOrder.id,
      company.id,
      newOrder.supplierId,
      newOrder.supplierName,
      newOrder.orderDate,
      newOrder.totalAmount,
      newOrder.paidAmount,
      newOrder.owedAmount,
      newOrder.state,
      newOrder.itemsJson || null,
    ]
  );
  return newOrder;
}

export async function mysqlUpdatePurchaseOrder(
  id: string,
  updates: Partial<PurchaseOrder>
): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.paidAmount !== undefined) {
    setClauses.push('paid_amount = ?');
    params.push(updates.paidAmount);
  }
  if (updates.owedAmount !== undefined) {
    setClauses.push('owed_amount = ?');
    params.push(updates.owedAmount);
  }
  if (updates.totalAmount !== undefined) {
    setClauses.push('total_amount = ?');
    params.push(updates.totalAmount);
  }
  if (updates.state !== undefined) {
    setClauses.push('state = ?');
    params.push(updates.state);
  }
  if (updates.itemsJson !== undefined) {
    setClauses.push('items_json = ?');
    params.push(updates.itemsJson);
  }

  if (setClauses.length === 0) return true;

  params.push(id, company.id);
  await pool.query(
    `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );
  return true;
}

export async function mysqlDeletePurchaseOrder(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  await pool.query(
    'DELETE FROM purchase_orders WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return true;
}

export async function mysqlProcessStockTransactions(
  transactions: Omit<StockTransaction, 'id' | 'date'>[]
): Promise<boolean> {
  if (!transactions || transactions.length === 0) return true;
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'inventory');

  const date = Date.now();
  const txs: any[] = transactions.map((t: any) => ({
    ...t,
    id: 'tx' + Math.random().toString(36).substr(2, 9),
    date,
  }));

  return await withMySqlTransaction(async (conn) => {
    for (const tx of txs) {
      await conn.query(
        'UPDATE raw_materials SET stock = stock + ? WHERE id = ? AND company_id = ?',
        [tx.quantityChanged, tx.rawMaterialId, company.id]
      );

      await conn.query(
        `INSERT INTO stock_transactions (
          id, company_id, raw_material_id, type, quantity_before, quantity_changed, 
          quantity_after, date, reason, reference_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tx.id,
          company.id,
          tx.rawMaterialId,
          tx.type,
          tx.quantityBefore,
          tx.quantityChanged,
          tx.quantityAfter,
          tx.date,
          tx.reason || null,
          tx.referenceId || null,
        ]
      );
    }

    return true;
  });
}

// --- BILLING / SALES ---
export async function mysqlGetNextBillId(overrideCompanyId?: string): Promise<{ id: string; count: number; companyId?: string }> {
  await ensureLocalMySqlInitialized();
  let companyId = overrideCompanyId;
  if (!companyId) {
    try {
      const company = await getAuthorizedCompanyContext();
      companyId = company.id;
    } catch {
      companyId = 'COMP-0001';
    }
  }
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;

  try {
    const pool = getMysqlPool();
    const pattern = `BILL-${datePrefix}-%`;
    const [salesRows]: any = await pool.query(
      'SELECT bill_number FROM sales WHERE company_id = ? AND bill_number LIKE ?',
      [companyId, pattern]
    );

    let maxSeq = 0;
    if (salesRows && salesRows.length > 0) {
      for (const r of salesRows) {
        const parts = (r.bill_number || '').split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq) && lastSeq > maxSeq) {
          maxSeq = lastSeq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return {
      id: `BILL-${datePrefix}-${String(nextSeq).padStart(3, '0')}`,
      count: maxSeq,
      companyId,
    };
  } catch (err: any) {
    console.error('mysqlGetNextBillId error:', err.message);
    return { id: `BILL-${datePrefix}-001`, count: 0, companyId };
  }
}

export async function mysqlUpdateSalePayment(
  billId: string,
  paymentMethod: string,
  cashReceived?: number,
  changeReturned?: number
): Promise<{ success: boolean; error?: string }> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  try {
    const saleDbId = billId.startsWith('BILL-') ? `${company.id}_${billId}` : billId;
    await pool.query(
      `UPDATE sales 
       SET payment_method = ?, payment_status = 'paid' 
       WHERE company_id = ? AND (id = ? OR bill_number = ? OR id = ?)`,
      [paymentMethod, company.id, billId, billId, saleDbId]
    );

    // Also update any matching dine_in_orders to marked Served
    await pool.query(
      `UPDATE dine_in_orders 
       SET serving_status = 'Served', updated_at = NOW() 
       WHERE company_id = ? AND (bill_id = ? OR order_number = ?)`,
      [company.id, billId, billId]
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('mysqlUpdateSalePayment error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function mysqlRefundSale(
  billId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  try {
    const saleDbId = billId.startsWith('BILL-') ? `${company.id}_${billId}` : billId;
    await pool.query(
      `UPDATE sales 
       SET payment_status = 'refunded' 
       WHERE company_id = ? AND (id = ? OR bill_number = ? OR id = ?)`,
      [company.id, billId, billId, saleDbId]
    );

    const [pRows]: any = await pool.query(
      `SELECT * FROM payments WHERE company_id = ? AND (sale_id = ? OR sale_id = ? OR reference_number = ?)`,
      [company.id, saleDbId, billId, billId]
    );

    if (pRows && pRows.length > 0) {
      await pool.query(
        `UPDATE payments SET status = 'refunded' WHERE company_id = ? AND (sale_id = ? OR sale_id = ? OR reference_number = ?)`,
        [company.id, saleDbId, billId, billId]
      );
    } else {
      const [sRows]: any = await pool.query(
        `SELECT * FROM sales WHERE company_id = ? AND (id = ? OR bill_number = ? OR id = ?) LIMIT 1`,
        [company.id, billId, billId, saleDbId]
      );
      if (sRows && sRows.length > 0) {
        const s = sRows[0];
        const payId = 'pay-' + Date.now();
        await pool.query(
          `INSERT INTO payments (id, company_id, sale_id, payment_method, amount, status, reference_number, notes)
           VALUES (?, ?, ?, ?, ?, 'refunded', ?, ?)`,
          [payId, company.id, saleDbId, s.payment_method || 'Cash', s.total, billId, reason || 'Refund issued']
        );
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('mysqlRefundSale error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function mysqlRecordSale(sale: any): Promise<{ success: boolean; sale?: any; error?: string }> {
  await ensureLocalMySqlInitialized();
  let company: { id: string };
  let isApiCall = false;
  try {
    company = await getAuthorizedCompanyContext();
  } catch (authErr) {
    if (sale.companyId) {
      company = { id: sale.companyId };
      isApiCall = true;
    } else {
      throw authErr;
    }
  }
  if (!isApiCall) {
    await assertCompanyModuleEnabled(company.id, 'sales');
    await assertCompanyModuleEnabled(company.id, 'bills');
  }
  const pool = getMysqlPool();

  try {
    let billNumber = sale.billNumber || sale.id;
    if (!billNumber) {
      const nextData = await mysqlGetNextBillId(company.id);
      billNumber = nextData.id;
    }
    const saleDbId = sale.id && !sale.id.startsWith('BILL-') ? sale.id : `${company.id}_${billNumber}`;

    // Idempotency check: if bill already exists in sales table for this company, return it safely
    if (billNumber) {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM sales WHERE company_id = ? AND (id = ? OR bill_number = ?) LIMIT 1',
        [company.id, saleDbId, billNumber]
      );
      if (existing && existing.length > 0) {
        return { success: true, sale: mapRowToSale(existing[0]) };
      }
    }

    // Product validation & recalculation using MySQL products table for this company
    const productIds = (sale.items || [])
      .map((i: any) => i.product?.id || i.productId || i.id)
      .filter(Boolean);
    let dbProducts: any[] = [];

    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [pRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, price, stock, tax, discount, raw_materials_json 
         FROM products 
         WHERE company_id = ? AND id IN (${placeholders})`,
        [company.id, ...productIds]
      );
      dbProducts = pRows;
    }

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedItemDiscounts = 0;

    const validatedItems = (sale.items || []).map((item: any) => {
      const prod = item.product || item;
      const prodId = prod?.id || item.productId;
      const dbP = prodId ? dbProducts.find((p) => p.id === prodId) : null;

      const price = dbP ? Number(dbP.price) : Number(prod?.price || item.price || 0);
      const discountRate = dbP ? Number(dbP.discount) : Number(prod?.discount || item.discount || 0);
      const taxRate = dbP ? Number(dbP.tax) : Number(prod?.tax || item.tax || 0);
      const qty = Number(item.quantity || 1);

      const itemSubtotal = price * qty;
      const itemDiscount = itemSubtotal * (discountRate / 100);
      const afterDiscount = itemSubtotal - itemDiscount;
      const itemTax = afterDiscount * (taxRate / 100);

      calculatedSubtotal += itemSubtotal;
      calculatedTax += itemTax;
      calculatedItemDiscounts += itemDiscount;

      return {
        ...item,
        quantity: qty,
        product: { ...(typeof prod === 'object' ? prod : {}), id: prodId || `p-${Date.now()}`, price, tax: taxRate, discount: discountRate },
      };
    });

    let globalDiscountAmount = 0;
    if (sale.isDiscountPercentage) {
      globalDiscountAmount = calculatedSubtotal * ((sale.discountValue || 0) / 100);
    } else {
      globalDiscountAmount = sale.discountValue || 0;
    }

    const calculatedTotal = calculatedSubtotal - calculatedItemDiscounts - globalDiscountAmount + calculatedTax;
    const calculatedCgst = calculatedTax / 2;
    const calculatedSgst = calculatedTax / 2;
    const roundOff = typeof sale.roundOff === 'number' ? sale.roundOff : 0;
    const finalTotal = roundOff !== 0 ? parseFloat((calculatedTotal + roundOff).toFixed(2)) : calculatedTotal;

    const session = await getSession();
    const cookieStore = await cookies();
    const authUsername = session?.username || cookieStore.get('auth_username')?.value || cookieStore.get('auth_id')?.value;
    const rawCreatedBy = sale.createdBy || authUsername || 'Cashier';
    const saleCreatedBy = rawCreatedBy === 'admin' ? 'superadmin' : rawCreatedBy;

    const finalSale = {
      ...sale,
      id: billNumber,
      companyId: company.id,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: calculatedItemDiscounts + globalDiscountAmount,
      tax: calculatedTax,
      cgst: calculatedCgst,
      sgst: calculatedSgst,
      roundOff,
      total: finalTotal,
      billNumber: billNumber,
      createdBy: saleCreatedBy,
      timestamp: sale.timestamp || Date.now(),
      syncStatus: 'COMPLETED' as const,
    };

    // Execute billing, stock updates, raw material deductions, and cash register in an atomic MySQL transaction
    await withMySqlTransaction(async (conn) => {
      let finalBillNumber = billNumber;
      let finalSaleDbId = saleDbId;

      // 0. Check if this exact sale was already inserted (idempotency)
      const [existingThisSale]: any = await conn.query(
        'SELECT * FROM sales WHERE company_id = ? AND id = ? LIMIT 1',
        [company.id, saleDbId]
      );
      if (existingThisSale && existingThisSale.length > 0) {
        return;
      }

      // Check if billNumber was already taken by a competing concurrent sale
      const [existingNumber]: any = await conn.query(
        'SELECT id FROM sales WHERE company_id = ? AND bill_number = ? LIMIT 1',
        [company.id, finalBillNumber]
      );
      if (existingNumber && existingNumber.length > 0) {
        // Resolve collision: allocate next atomic sequence from bill_sequences with FOR UPDATE
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const datePrefix = `${dd}${mm}${yy}`;

        await conn.query(
          `INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
           VALUES (?, ?, 0)
           ON DUPLICATE KEY UPDATE company_id = company_id`,
          [company.id, datePrefix]
        );

        const [seqRow]: any = await conn.query(
          `SELECT last_seq FROM bill_sequences WHERE company_id = ? AND date_prefix = ? FOR UPDATE`,
          [company.id, datePrefix]
        );
        const nextSeq = (seqRow && seqRow[0] ? Number(seqRow[0].last_seq) : 0) + 1;
        await conn.query(
          `UPDATE bill_sequences SET last_seq = ? WHERE company_id = ? AND date_prefix = ?`,
          [nextSeq, company.id, datePrefix]
        );
        finalBillNumber = `BILL-${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
        finalSaleDbId = `${company.id}_${finalBillNumber}`;
        finalSale.id = finalBillNumber;
        finalSale.billNumber = finalBillNumber;
      }

      // 1. Insert into sales table with company_id, waiter, table, order_type, order_source, and online_order_id
      await conn.query(
        `INSERT INTO sales (
          id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, 
          payment_method, payment_status, customer_name, customer_phone, table_id, table_name, waiter_id, waiter_name, serving_status, order_type, order_source, online_order_id, order_note, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000))`,
        [
          finalSaleDbId,
          company.id,
          finalBillNumber,
          JSON.stringify(finalSale.items),
          finalSale.subtotal,
          finalSale.discount,
          finalSale.tax,
          finalSale.roundOff,
          finalSale.total,
          finalSale.paymentMethod || 'Cash',
          finalSale.paymentStatus || (finalSale.paymentMethod === 'Bill Only' ? 'unpaid' : 'paid'),
          finalSale.customerName || null,
          finalSale.customerPhone || null,
          finalSale.tableId || null,
          finalSale.tableName || null,
          finalSale.waiterId || null,
          finalSale.waiterName || null,
          finalSale.servingStatus || (finalSale.orderType === 'Dine In' ? 'Served' : 'Completed'),
          finalSale.orderType || 'Dine In',
          finalSale.orderSource || 'Terminal',
          finalSale.onlineOrderId || null,
          finalSale.orderNote || null,
          finalSale.createdBy || null,
          finalSale.timestamp,
        ]
      );

      // Update matching dine_in_orders with bill_id and mark serving_status = 'Served' if paid
      if (finalSale.orderType === 'Dine In') {
        try {
          if (finalSale.tableId || finalSale.tableName) {
            const isUnpaidBill = finalSale.paymentStatus === 'unpaid' || finalSale.paymentMethod === 'Bill Only';
            await conn.query(
              `UPDATE dine_in_orders 
               SET bill_id = ?, 
                   serving_status = CASE WHEN ? = 1 THEN serving_status ELSE 'Served' END, 
                   updated_at = NOW() 
               WHERE company_id = ? 
                 AND (table_id = ? OR table_name = ?) 
                 AND (bill_id IS NULL OR bill_id = '')`,
              [finalBillNumber, isUnpaidBill ? 1 : 0, company.id, finalSale.tableId || '', finalSale.tableName || '']
            );
          }
        } catch (dioErr) {
          console.warn('Notice updating dine_in_orders for bill:', dioErr);
        }
      }

      // Keep bill_sequences table updated with the highest recorded sequence
      const parts = (finalBillNumber || '').split('-');
      const recordedSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(recordedSeq) && recordedSeq >= 0 && recordedSeq < 1000000) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const datePrefix = `${dd}${mm}${yy}`;
        await conn.query(
          `INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq))`,
          [company.id, datePrefix, recordedSeq]
        );
      }

      // 2. Decrement product stock in products table
      for (const item of finalSale.items) {
        const prodId = item.product?.id || item.productId || item.id;
        if (prodId) {
          await conn.query(
            'UPDATE products SET stock = stock - ? WHERE id = ? AND company_id = ?',
            [item.quantity || 1, prodId, company.id]
          );
        }
      }

      // 3. Raw materials recipe deduction if any
      const [allRawMaterialsRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, name, sku, unit, stock, cost_per_unit, low_stock_limit, created_at, updated_at FROM raw_materials WHERE company_id = ?',
        [company.id]
      );
      const allRawMaterials = allRawMaterialsRows.map(mapRowToRawMaterial);

      for (const item of finalSale.items) {
        const prodId = item.product?.id || item.productId || item.id;
        if (!prodId) continue;
        const dbP = dbProducts.find((p) => p.id === prodId);
        const productToUse = dbP || item.product;

        if (!productToUse) continue;

        let rawMaterialsList = productToUse.rawMaterials;
        if (dbP && dbP.raw_materials_json) {
          try {
            rawMaterialsList = typeof dbP.raw_materials_json === 'string'
              ? JSON.parse(dbP.raw_materials_json)
              : dbP.raw_materials_json;
          } catch {}
        }

        if (rawMaterialsList && rawMaterialsList.length > 0) {
          const deductions = await calculateRecipeDeduction(rawMaterialsList, item.quantity, allRawMaterials);
          for (const d of deductions) {
            await conn.query(
              'UPDATE raw_materials SET stock = stock - ? WHERE id = ? AND company_id = ?',
              [d.quantityToDeduct, d.materialId, company.id]
            );

            await conn.query(
              `INSERT INTO stock_transactions (
                id, company_id, raw_material_id, type, quantity_before, quantity_changed, 
                quantity_after, date, reason, reference_id, created_at
              ) VALUES (?, ?, ?, 'Stock Deduction', 0, ?, 0, ?, ?, ?, NOW())`,
              [
                'tx' + Math.random().toString(36).substr(2, 9),
                company.id,
                d.materialId,
                -d.quantityToDeduct,
                finalSale.timestamp,
                `Sale ${finalBillNumber}`,
                finalBillNumber,
              ]
            );
          }
        }
      }

      // 4. Cash Register entry for cash sales
      if (finalSale.paymentMethod === 'Cash') {
        const crId = 'cr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
        await conn.query(
          `INSERT INTO cash_register (
            id, company_id, sale_id, bill_number, type, amount, amount_received, change_given, created_at
          ) VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, FROM_UNIXTIME(? / 1000))`,
          [
            crId,
            company.id,
            finalSaleDbId,
            finalBillNumber,
            finalSale.total,
            finalSale.amountReceived || finalSale.total,
            finalSale.changeAmount || 0,
            finalSale.timestamp,
          ]
        );
      }

      // 5. Payment record
      try {
        const payId = 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
        await conn.query(
          `INSERT INTO payments (
            id, company_id, sale_id, payment_method, amount, status, reference_number, created_at
          ) VALUES (?, ?, ?, ?, ?, 'paid', ?, FROM_UNIXTIME(? / 1000))`,
          [
            payId,
            company.id,
            finalSaleDbId,
            finalSale.paymentMethod || 'Cash',
            finalSale.total,
            finalBillNumber,
            finalSale.timestamp,
          ]
        );
      } catch (payErr: any) {
        console.warn('Payment record insertion notice:', payErr.message);
      }

      // 6. Delivery record & automatic delivery person assignment (Strictly when orderType is 'Delivery')
      if (finalSale.orderType === 'Delivery') {
        const [existingDelivery]: any = await conn.query(
          'SELECT id, delivery_person_id, delivery_status, assignment_status, tracking_token, order_source FROM deliveries WHERE company_id = ? AND bill_id = ? LIMIT 1',
          [company.id, finalBillNumber]
        );

        if (!existingDelivery || existingDelivery.length === 0) {
          const deliveryId = 'del-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
          const rawName = (finalSale.customerName || '').trim();
          const customerName = (rawName === 'Customer' || rawName === 'Online Customer') ? '' : rawName;
          const customerPhone = (finalSale.customerPhone || '').trim();
          const rawAddress = (finalSale.deliveryAddress || finalSale.address || '').trim();
          const deliveryAddress = (rawAddress === 'Online Order Delivery Address' || rawAddress === 'No address specified') ? '' : rawAddress;
          const deliveryNotes = finalSale.deliveryNotes || finalSale.orderNote || null;
          const orderSource = finalSale.orderSource || 'Terminal';
          const onlineOrderId = finalSale.onlineOrderId || null;
          const trackingToken = 'trk_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

          const initialHistory = [
            {
              status: 'pending' as DeliveryStatus,
              timestamp: Date.now(),
              note: `Delivery order created via ${orderSource}`,
            },
          ];

          await conn.query(
            `INSERT INTO deliveries (
              id, company_id, bill_id, order_source, online_order_id, tracking_token,
              customer_name, customer_phone, delivery_address,
              delivery_person_id, delivery_status, assignment_status, order_time,
              delivery_notes, status_history, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', 'unassigned', FROM_UNIXTIME(? / 1000), ?, ?, NOW())`,
            [
              deliveryId,
              company.id,
              finalBillNumber,
              orderSource,
              onlineOrderId,
              trackingToken,
              customerName || '',
              customerPhone || '',
              deliveryAddress || '',
              finalSale.timestamp,
              deliveryNotes,
              JSON.stringify(initialHistory),
            ]
          );

          let assignResult: {
            assigned: boolean;
            deliveryPerson: any;
            message: string;
          };

          const targetStaffId = finalSale.deliveryPersonId;

          if (targetStaffId && targetStaffId !== 'none' && targetStaffId !== 'auto') {
            // Assign specifically selected delivery staff member from delivery collection
            const [staffRows]: any = await conn.query(
              `SELECT id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries
               FROM delivery_persons WHERE id = ? AND company_id = ? FOR UPDATE`,
              [targetStaffId, company.id]
            );

            if (staffRows && staffRows.length > 0 && staffRows[0].is_active) {
              const staff = staffRows[0];
              const newCount = (Number(staff.assigned_delivery_count) || 0) + 1;
              const maxDeliveries = Number(staff.max_active_deliveries) || 3;
              const isNowBusy = newCount >= maxDeliveries;

              await conn.query(
                `UPDATE delivery_persons
                 SET assigned_delivery_count = ?,
                     last_assigned_at = NOW(),
                     availability_status = ?
                 WHERE id = ? AND company_id = ?`,
                [newCount, isNowBusy ? 'busy' : staff.availability_status, staff.id, company.id]
              );

              initialHistory.push({
                status: 'assigned',
                timestamp: Date.now(),
                note: `Assigned to delivery staff ${staff.name} (${staff.employee_id})`,
              });

              await conn.query(
                `UPDATE deliveries
                 SET delivery_person_id = ?,
                     assignment_status = 'assigned',
                     delivery_status = 'assigned',
                     assigned_at = NOW(),
                     status_history = ?
                 WHERE id = ? AND company_id = ?`,
                [staff.id, JSON.stringify(initialHistory), deliveryId, company.id]
              );

              assignResult = {
                assigned: true,
                deliveryPerson: {
                  id: staff.id,
                  name: staff.name,
                  employeeId: staff.employee_id,
                  phone: staff.phone,
                },
                message: `Assigned to ${staff.name}`,
              };
            } else {
              // Fallback to auto-assignment if specific staff is inactive
              assignResult = await assignDeliveryToAvailablePersonInternal(conn, company.id, deliveryId);
              if (assignResult.assigned) {
                initialHistory.push({
                  status: 'assigned',
                  timestamp: Date.now(),
                  note: assignResult.message,
                });
                await conn.query(
                  'UPDATE deliveries SET status_history = ? WHERE id = ? AND company_id = ?',
                  [JSON.stringify(initialHistory), deliveryId, company.id]
                );
              }
            }
          } else if (targetStaffId === 'none') {
            // Cashier explicitly chose unassigned
            assignResult = {
              assigned: false,
              deliveryPerson: null,
              message: 'Unassigned',
            };
          } else {
            // Auto-assign to available delivery person with lowest workload
            assignResult = await assignDeliveryToAvailablePersonInternal(conn, company.id, deliveryId);
            if (assignResult.assigned) {
              initialHistory.push({
                status: 'assigned',
                timestamp: Date.now(),
                note: assignResult.message,
              });
              await conn.query(
                'UPDATE deliveries SET status_history = ? WHERE id = ? AND company_id = ?',
                [JSON.stringify(initialHistory), deliveryId, company.id]
              );
            }
          }

          (finalSale as any).delivery = {
            id: deliveryId,
            billId: finalBillNumber,
            orderSource,
            onlineOrderId,
            trackingToken,
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryStatus: assignResult.assigned ? 'assigned' : 'pending',
            assignmentStatus: assignResult.assigned ? 'assigned' : 'unassigned',
            deliveryPerson: assignResult.deliveryPerson,
            deliveryPersonName: assignResult.deliveryPerson?.name || null,
            deliveryPersonPhone: assignResult.deliveryPerson?.phone || null,
            message: assignResult.message,
          };
        } else {
          (finalSale as any).delivery = existingDelivery[0];
        }
      }
    });

    return { success: true, sale: finalSale };
  } catch (err: any) {
    console.error('mysqlRecordSale error:', err.message);
    return { success: false, error: 'Local MySQL error: ' + err.message };
  }
}

export async function mysqlGetLiveSales(filterCompanyId?: string): Promise<any[]> {
  await ensureLocalMySqlInitialized();
  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authUser = session?.username || cookieStore.get("auth_username")?.value;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;
  const pool = getMysqlPool();

  try {
    // 1. CASHIER: Strictly sees only the sales created by that cashier for their company
    if (authRole === "cashier") {
      const company = await getAuthorizedCompanyContext();
      await assertCompanyModuleEnabled(company.id, 'sales');
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.company_id, s.bill_number, s.items, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
                s.payment_method, s.payment_status, s.customer_name, s.customer_phone, s.order_type, s.order_source, s.online_order_id, s.order_note, s.created_by, s.created_at,
                c.name AS company_name,
                d.id AS delivery_id, d.delivery_status, d.assignment_status, d.delivery_address, d.delivery_notes,
                d.order_source AS delivery_order_source, d.online_order_id AS delivery_online_order_id, d.tracking_token,
                dp.name AS delivery_person_name, dp.phone AS delivery_person_phone
         FROM sales s
         LEFT JOIN companies c ON s.company_id = c.id
         LEFT JOIN deliveries d ON d.company_id = s.company_id AND d.bill_id = s.bill_number
         LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
         WHERE s.company_id = ? AND (s.created_by = ? OR s.created_by = ? OR s.created_by IS NULL OR s.created_by = 'Cashier')
         ORDER BY s.created_at DESC 
         LIMIT 200`,
        [company.id, authUser || 'cashier', authId || 'cashier']
      );
      return rows.map(mapRowToSale);
    }

    // 2. COMPANY ADMIN & MANAGER: Sees all sales belonging to their assigned company
    if (authRole === "company_admin" || authRole === "manager") {
      const company = await getAuthorizedCompanyContext();
      await assertCompanyModuleEnabled(company.id, 'sales');
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.company_id, s.bill_number, s.items, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
                s.payment_method, s.payment_status, s.customer_name, s.customer_phone, s.order_type, s.order_source, s.online_order_id, s.order_note, s.created_by, s.created_at,
                c.name AS company_name,
                d.id AS delivery_id, d.delivery_status, d.assignment_status, d.delivery_address, d.delivery_notes,
                d.order_source AS delivery_order_source, d.online_order_id AS delivery_online_order_id, d.tracking_token,
                dp.name AS delivery_person_name, dp.phone AS delivery_person_phone
         FROM sales s
         LEFT JOIN companies c ON s.company_id = c.id
         LEFT JOIN deliveries d ON d.company_id = s.company_id AND d.bill_id = s.bill_number
         LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
         WHERE s.company_id = ? 
         ORDER BY s.created_at DESC 
         LIMIT 200`,
        [company.id]
      );
      return rows.map(mapRowToSale);
    }

    // 3. SUPER ADMIN: Can view sales across all companies, or filter by specific company
    const targetCompId = filterCompanyId || cookieStore.get("auth_company_id")?.value;
    let query = `
      SELECT s.id, s.company_id, s.bill_number, s.items, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
             s.payment_method, s.payment_status, s.customer_name, s.customer_phone, s.order_type, s.order_source, s.online_order_id, s.order_note, s.created_by, s.created_at,
             c.name AS company_name,
             d.id AS delivery_id, d.delivery_status, d.assignment_status, d.delivery_address, d.delivery_notes,
             d.order_source AS delivery_order_source, d.online_order_id AS delivery_online_order_id, d.tracking_token,
             dp.name AS delivery_person_name, dp.phone AS delivery_person_phone
      FROM sales s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN deliveries d ON d.company_id = s.company_id AND d.bill_id = s.bill_number
      LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
    `;
    const params: any[] = [];
    if (targetCompId && targetCompId !== "all") {
      query += ` WHERE s.company_id = ? `;
      params.push(targetCompId);
    }
    query += ` ORDER BY s.created_at DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows.map(mapRowToSale);
  } catch (err: any) {
    console.error('mysqlGetLiveSales error:', err.message);
    return [];
  }
}

export async function mysqlClearAllSales(): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  await assertCompanyModuleEnabled(company.id, 'sales');
  return await withMySqlTransaction(async (conn) => {
    await conn.query('DELETE FROM cash_register WHERE company_id = ?', [company.id]);
    try {
      await conn.query("DELETE FROM stock_transactions WHERE company_id = ? AND reason LIKE 'Sale %'", [company.id]);
    } catch {}
    try {
      await conn.query('DELETE FROM payments WHERE company_id = ?', [company.id]);
    } catch {}
    await conn.query('DELETE FROM sales WHERE company_id = ?', [company.id]);
    return true;
  });
}

// --- CUSTOMERS ---
export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  createdAt: number;
}

export async function mysqlGetCustomers(): Promise<Customer[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC',
    [company.id]
  );
  return rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    phone: r.phone || undefined,
    email: r.email || undefined,
    address: r.address || undefined,
    gstin: r.gstin || undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}

export async function mysqlCreateCustomer(data: Omit<Customer, 'id' | 'companyId' | 'createdAt'>): Promise<Customer> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await pool.query(
    `INSERT INTO customers (id, company_id, name, phone, email, address, gstin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, company.id, data.name, data.phone || null, data.email || null, data.address || null, data.gstin || null]
  );
  return {
    id,
    companyId: company.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    gstin: data.gstin,
    createdAt: Date.now(),
  };
}

export async function mysqlUpdateCustomer(id: string, updates: Partial<Customer>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const clauses: string[] = [];
  const params: any[] = [];
  if (updates.name !== undefined) { clauses.push('name = ?'); params.push(updates.name); }
  if (updates.phone !== undefined) { clauses.push('phone = ?'); params.push(updates.phone || null); }
  if (updates.email !== undefined) { clauses.push('email = ?'); params.push(updates.email || null); }
  if (updates.address !== undefined) { clauses.push('address = ?'); params.push(updates.address || null); }
  if (updates.gstin !== undefined) { clauses.push('gstin = ?'); params.push(updates.gstin || null); }
  if (clauses.length === 0) return true;
  params.push(id, company.id);
  const [res]: any = await pool.query(
    `UPDATE customers SET ${clauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );
  return res.affectedRows > 0;
}

export async function mysqlDeleteCustomer(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();
  const [res]: any = await pool.query(
    'DELETE FROM customers WHERE id = ? AND company_id = ?',
    [id, company.id]
  );
  return res.affectedRows > 0;
}

export interface CustomerWithStats extends Customer {
  visits: number;
  lastVisit?: number;
  totalSpent: number;
  avgBill: number;
}

export async function mysqlGetCustomersWithStats(): Promise<CustomerWithStats[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const [customerRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC',
    [company.id]
  );

  let salesStatsRows: RowDataPacket[] = [];
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         TRIM(LOWER(customer_name)) as name_key,
         TRIM(customer_phone) as phone_key,
         COUNT(*) as visits,
         MAX(created_at) as last_visit,
         SUM(total) as total_spent
       FROM sales 
       WHERE company_id = ? AND payment_status != 'cancelled' AND (customer_name IS NOT NULL OR customer_phone IS NOT NULL)
       GROUP BY TRIM(LOWER(customer_name)), TRIM(customer_phone)`,
      [company.id]
    );
    salesStatsRows = rows;
  } catch (err: any) {
    // If customer_phone column is not yet queried or migrated
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         TRIM(LOWER(customer_name)) as name_key,
         NULL as phone_key,
         COUNT(*) as visits,
         MAX(created_at) as last_visit,
         SUM(total) as total_spent
       FROM sales 
       WHERE company_id = ? AND payment_status != 'cancelled' AND customer_name IS NOT NULL
       GROUP BY TRIM(LOWER(customer_name))`,
      [company.id]
    );
    salesStatsRows = rows;
  }

  const statsByName = new Map<string, { visits: number; lastVisit?: number; totalSpent: number }>();
  const statsByPhone = new Map<string, { visits: number; lastVisit?: number; totalSpent: number }>();

  for (const row of salesStatsRows) {
    const visits = Number(row.visits) || 0;
    const totalSpent = Number(row.total_spent) || 0;
    const lastVisit = row.last_visit ? new Date(row.last_visit).getTime() : undefined;

    if (row.name_key) {
      const prev = statsByName.get(row.name_key) || { visits: 0, totalSpent: 0, lastVisit: undefined };
      statsByName.set(row.name_key, {
        visits: prev.visits + visits,
        totalSpent: prev.totalSpent + totalSpent,
        lastVisit: Math.max(prev.lastVisit || 0, lastVisit || 0) || lastVisit,
      });
    }
    if (row.phone_key) {
      const prev = statsByPhone.get(row.phone_key) || { visits: 0, totalSpent: 0, lastVisit: undefined };
      statsByPhone.set(row.phone_key, {
        visits: prev.visits + visits,
        totalSpent: prev.totalSpent + totalSpent,
        lastVisit: Math.max(prev.lastVisit || 0, lastVisit || 0) || lastVisit,
      });
    }
  }

  return customerRows.map((r: any) => {
    const nameKey = (r.name || '').trim().toLowerCase();
    const phoneKey = (r.phone || '').trim();

    const stat = statsByName.get(nameKey) || (phoneKey ? statsByPhone.get(phoneKey) : null) || { visits: 0, totalSpent: 0, lastVisit: undefined };
    const visits = stat.visits;
    const totalSpent = stat.totalSpent;
    const avgBill = visits > 0 ? Number((totalSpent / visits).toFixed(2)) : 0;

    return {
      id: r.id,
      companyId: r.company_id,
      name: r.name,
      phone: r.phone || undefined,
      email: r.email || undefined,
      address: r.address || undefined,
      gstin: r.gstin || undefined,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      visits,
      lastVisit: stat.lastVisit,
      totalSpent: Number(totalSpent.toFixed(2)),
      avgBill,
    };
  });
}

export async function mysqlGetCustomerRecentOrders(customerName?: string, customerPhone?: string): Promise<any[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  if (!customerName && !customerPhone) return [];

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.company_id, s.bill_number, s.items, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
              s.payment_method, s.payment_status, s.customer_name, s.customer_phone, s.order_type, s.order_note, s.created_by, s.created_at
       FROM sales s
       WHERE s.company_id = ? 
         AND (
           (s.customer_name IS NOT NULL AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(?)))
           OR (? IS NOT NULL AND ? != '' AND s.customer_phone IS NOT NULL AND TRIM(s.customer_phone) = TRIM(?))
         )
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [company.id, customerName || '', customerPhone || '', customerPhone || '', customerPhone || '']
    );
    return rows.map(mapRowToSale);
  } catch (err: any) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.company_id, s.bill_number, s.items, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
              s.payment_method, s.payment_status, s.customer_name, s.order_type, s.created_by, s.created_at
       FROM sales s
       WHERE s.company_id = ? 
         AND s.customer_name IS NOT NULL AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(?))
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [company.id, customerName || '']
    );
    return rows.map(mapRowToSale);
  }
}

// ==========================================
// --- DELIVERY & DELIVERY PERSON MODULE ---
// ==========================================

/**
 * Concurrency-safe fair automatic delivery person assignment within an open transaction connection.
 * Row-level locks (FOR UPDATE) prevent simultaneous orders from race conditions.
 */
export async function assignDeliveryToAvailablePersonInternal(
  conn: any,
  companyId: string,
  deliveryId: string
): Promise<{ assigned: boolean; deliveryPerson: any | null; message: string }> {
  // Fair selection:
  // Active (is_active = 1), Available (availability_status = 'available'),
  // Under maximum limit (assigned_delivery_count < max_active_deliveries),
  // Ordered by lowest workload ASC, earliest last_assigned_at ASC, and id ASC.
  const [candidates]: any = await conn.query(
    `SELECT id, name, employee_id, phone, assigned_delivery_count, max_active_deliveries
     FROM delivery_persons
     WHERE company_id = ? 
       AND is_active = 1 
       AND availability_status = 'available'
       AND assigned_delivery_count < max_active_deliveries
     ORDER BY assigned_delivery_count ASC, COALESCE(last_assigned_at, '1970-01-01 00:00:00') ASC, id ASC
     LIMIT 1
     FOR UPDATE`,
    [companyId]
  );

  if (!candidates || candidates.length === 0) {
    // No eligible delivery person available
    await conn.query(
      `UPDATE deliveries 
       SET delivery_person_id = NULL, assignment_status = 'unassigned', delivery_status = 'pending'
       WHERE id = ? AND company_id = ?`,
      [deliveryId, companyId]
    );
    return {
      assigned: false,
      deliveryPerson: null,
      message: 'No delivery person available',
    };
  }

  const person = candidates[0];
  const newCount = (Number(person.assigned_delivery_count) || 0) + 1;
  const maxDeliveries = Number(person.max_active_deliveries) || 3;
  const isNowBusy = newCount >= maxDeliveries;

  // 1. Update delivery person workload, timestamp, and availability status
  await conn.query(
    `UPDATE delivery_persons
     SET assigned_delivery_count = ?,
         last_assigned_at = NOW(),
         availability_status = ?
     WHERE id = ? AND company_id = ?`,
    [newCount, isNowBusy ? 'busy' : 'available', person.id, companyId]
  );

  // 2. Update delivery with assigned staff
  await conn.query(
    `UPDATE deliveries
     SET delivery_person_id = ?,
         assignment_status = 'assigned',
         delivery_status = 'assigned',
         assigned_at = NOW()
     WHERE id = ? AND company_id = ?`,
    [person.id, deliveryId, companyId]
  );

  return {
    assigned: true,
    deliveryPerson: {
      id: person.id,
      name: person.name,
      employeeId: person.employee_id,
      phone: person.phone,
    },
    message: `Assigned to ${person.name}`,
  };
}

/**
 * Fetch all registered delivery persons for the active company.
 */
export async function mysqlGetDeliveryPersons(): Promise<DeliveryPerson[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM delivery_persons WHERE company_id = ? ORDER BY name ASC`,
    [company.id]
  );

  return rows.map(mapRowToDeliveryPerson);
}

/**
 * Register a new delivery person for the active company.
 */
export async function mysqlCreateDeliveryPerson(data: {
  name: string;
  employeeId: string;
  phone: string;
  maxActiveDeliveries?: number;
}): Promise<DeliveryPerson> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const id = 'dp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const maxActive = data.maxActiveDeliveries && data.maxActiveDeliveries > 0 ? data.maxActiveDeliveries : 3;

  await pool.query(
    `INSERT INTO delivery_persons (
      id, company_id, name, employee_id, phone, is_active, availability_status, 
      assigned_delivery_count, max_active_deliveries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 'available', 0, ?, NOW(), NOW())`,
    [id, company.id, data.name.trim(), data.employeeId.trim(), data.phone.trim(), maxActive]
  );

  const [createdRows]: any = await pool.query(
    'SELECT * FROM delivery_persons WHERE id = ? AND company_id = ?',
    [id, company.id]
  );

  return mapRowToDeliveryPerson(createdRows[0]);
}

/**
 * Update an existing delivery person's profile, active state, or availability.
 */
export async function mysqlUpdateDeliveryPerson(
  id: string,
  updates: Partial<DeliveryPerson>
): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name.trim());
  }
  if (updates.employeeId !== undefined) {
    setClauses.push('employee_id = ?');
    params.push(updates.employeeId.trim());
  }
  if (updates.phone !== undefined) {
    setClauses.push('phone = ?');
    params.push(updates.phone.trim());
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }
  if (updates.availabilityStatus !== undefined) {
    setClauses.push('availability_status = ?');
    params.push(updates.availabilityStatus);
  }
  if (updates.maxActiveDeliveries !== undefined) {
    setClauses.push('max_active_deliveries = ?');
    params.push(Number(updates.maxActiveDeliveries) || 3);
  }

  if (setClauses.length === 0) return true;

  params.push(id, company.id);

  const [result]: any = await pool.query(
    `UPDATE delivery_persons SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ? AND company_id = ?`,
    params
  );

  return result.affectedRows > 0;
}

/**
 * Delete a delivery person if they have no active deliveries.
 */
export async function mysqlDeleteDeliveryPerson(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  // Check if they have active assigned deliveries
  const [activeDels]: any = await pool.query(
    `SELECT COUNT(*) AS active_count FROM deliveries 
     WHERE company_id = ? AND delivery_person_id = ? AND delivery_status IN ('assigned', 'picked_up', 'in_transit')`,
    [company.id, id]
  );

  if (activeDels && activeDels[0]?.active_count > 0) {
    throw new Error('Cannot delete delivery person with active in-progress deliveries. Reassign or complete them first.');
  }

  const [result]: any = await pool.query(
    `DELETE FROM delivery_persons WHERE id = ? AND company_id = ?`,
    [id, company.id]
  );

  return result.affectedRows > 0;
}

/**
 * Fetch deliveries for the company with optional status/search filters.
 */
export async function mysqlGetDeliveries(filter?: {
  status?: string;
  search?: string;
}): Promise<Delivery[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  let query = `
    SELECT d.id, d.company_id, d.bill_id, d.order_source, d.online_order_id, d.tracking_token,
           d.customer_name, d.customer_phone, d.delivery_address,
           d.delivery_person_id, d.delivery_status, d.assignment_status, d.order_time,
           d.assigned_at, d.picked_up_at, d.delivered_at, d.delivery_notes, d.status_history,
           d.latitude, d.longitude, d.location_updated_at, d.created_at, d.updated_at,
           dp.name AS delivery_person_name, dp.phone AS delivery_person_phone,
           s.items AS sale_items, s.total AS sale_total, s.payment_method AS sale_payment_method, s.payment_status AS sale_payment_status
    FROM deliveries d
    LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
    LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
    WHERE d.company_id = ?
  `;
  const params: any[] = [company.id];

  if (filter?.status && filter.status !== 'all') {
    if (filter.status === 'unassigned') {
      query += ` AND d.assignment_status = 'unassigned'`;
    } else if (filter.status === 'in_transit' || filter.status === 'out_for_delivery') {
      query += ` AND (d.delivery_status = 'in_transit' OR d.delivery_status = 'out_for_delivery')`;
    } else if (filter.status === 'cancelled' || filter.status === 'failed') {
      query += ` AND (d.delivery_status = 'cancelled' OR d.delivery_status = 'failed')`;
    } else {
      query += ` AND d.delivery_status = ?`;
      params.push(filter.status);
    }
  }

  if (filter?.search && filter.search.trim() !== '') {
    const q = `%${filter.search.trim()}%`;
    query += ` AND (d.bill_id LIKE ? OR d.customer_name LIKE ? OR d.customer_phone LIKE ? OR dp.name LIKE ? OR d.online_order_id LIKE ?)`;
    params.push(q, q, q, q, q);
  }

  query += ` ORDER BY d.created_at DESC LIMIT 300`;

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows.map(mapRowToDelivery);
}

/**
 * Fetch a single delivery by bill ID.
 */
export async function mysqlGetDeliveryByBillId(billId: string): Promise<Delivery | null> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.company_id, d.bill_id, d.order_source, d.online_order_id, d.tracking_token,
            d.customer_name, d.customer_phone, d.delivery_address,
            d.delivery_person_id, d.delivery_status, d.assignment_status, d.order_time,
            d.assigned_at, d.picked_up_at, d.delivered_at, d.delivery_notes, d.status_history,
            d.latitude, d.longitude, d.location_updated_at, d.created_at, d.updated_at,
            dp.name AS delivery_person_name, dp.phone AS delivery_person_phone,
            s.items AS sale_items, s.total AS sale_total, s.payment_method AS sale_payment_method, s.payment_status AS sale_payment_status
     FROM deliveries d
     LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
     LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
     WHERE d.company_id = ? AND d.bill_id = ?
     LIMIT 1`,
    [company.id, billId]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToDelivery(rows[0]);
}

/**
 * Update delivery status with automatic workload tracking, status history, and availability restoration.
 */
export async function mysqlUpdateDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus,
  deliveryNotes?: string
): Promise<{ success: boolean; delivery?: Delivery; error?: string }> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();

  return await withMySqlTransaction(async (conn) => {
    const [rows]: any = await conn.query(
      `SELECT * FROM deliveries WHERE id = ? AND company_id = ? FOR UPDATE`,
      [deliveryId, company.id]
    );

    if (!rows || rows.length === 0) {
      return { success: false, error: 'Delivery record not found' };
    }

    const current = rows[0];
    const prevStatus: DeliveryStatus = current.delivery_status;
    const personId: string | null = current.delivery_person_id;

    const isActiveStatus = (st: string) =>
      ['assigned', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'in_transit'].includes(st);
    const isCompletedStatus = (st: string) =>
      ['delivered', 'cancelled', 'failed'].includes(st);

    // If transitioning from an in-progress status to delivered or cancelled/failed, free up the delivery person
    if (personId && isActiveStatus(prevStatus) && isCompletedStatus(newStatus)) {
      const [pRows]: any = await conn.query(
        `SELECT id, is_active, availability_status, assigned_delivery_count, max_active_deliveries
         FROM delivery_persons WHERE id = ? AND company_id = ? FOR UPDATE`,
        [personId, company.id]
      );

      if (pRows && pRows.length > 0) {
        const dp = pRows[0];
        const newCount = Math.max(0, (Number(dp.assigned_delivery_count) || 0) - 1);
        const maxLimit = Number(dp.max_active_deliveries) || 3;
        // If they drop below their limit and are still active, restore their availability to 'available'
        const restoredAvailability =
          dp.is_active && newCount < maxLimit && dp.availability_status === 'busy'
            ? 'available'
            : dp.availability_status;

        await conn.query(
          `UPDATE delivery_persons
           SET assigned_delivery_count = ?, availability_status = ?
           WHERE id = ? AND company_id = ?`,
          [newCount, restoredAvailability, personId, company.id]
        );
      }
    }

    // Build delivery update query
    const setClauses: string[] = ['delivery_status = ?'];
    const params: any[] = [newStatus];

    if (newStatus === 'picked_up' && !current.picked_up_at) {
      setClauses.push('picked_up_at = NOW()');
    } else if (newStatus === 'delivered' && !current.delivered_at) {
      setClauses.push('delivered_at = NOW()');
    }

    if (deliveryNotes !== undefined) {
      setClauses.push('delivery_notes = ?');
      params.push(deliveryNotes);
    }

    // Append to status_history
    let history: any[] = [];
    if (current.status_history) {
      try {
        history = typeof current.status_history === 'string' ? JSON.parse(current.status_history) : current.status_history;
      } catch {
        history = [];
      }
    }
    history.push({
      status: newStatus,
      timestamp: Date.now(),
      note: deliveryNotes || undefined,
    });
    setClauses.push('status_history = ?');
    params.push(JSON.stringify(history));

    params.push(deliveryId, company.id);

    await conn.query(
      `UPDATE deliveries SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ? AND company_id = ?`,
      params
    );

    const [updatedRows]: any = await conn.query(
      `SELECT d.*, dp.name AS delivery_person_name, dp.phone AS delivery_person_phone,
              s.items AS sale_items, s.total AS sale_total, s.payment_method AS sale_payment_method, s.payment_status AS sale_payment_status
       FROM deliveries d
       LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
       LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
       WHERE d.id = ? AND d.company_id = ?`,
      [deliveryId, company.id]
    );

    return {
      success: true,
      delivery: mapRowToDelivery(updatedRows[0]),
    };
  });
}

/**
 * Manually assign or reassign a delivery person to an order.
 * Accurately updates workload counts for previous and newly assigned staff.
 */
export async function mysqlManualAssignDelivery(
  deliveryId: string,
  targetPersonId: string | null
): Promise<{ success: boolean; delivery?: Delivery; error?: string }> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();

  return await withMySqlTransaction(async (conn) => {
    const [rows]: any = await conn.query(
      `SELECT * FROM deliveries WHERE id = ? AND company_id = ? FOR UPDATE`,
      [deliveryId, company.id]
    );

    if (!rows || rows.length === 0) {
      return { success: false, error: 'Delivery record not found' };
    }

    const current = rows[0];
    const oldPersonId = current.delivery_person_id;

    // If reassigning from an old person, decrement their workload
    if (oldPersonId && oldPersonId !== targetPersonId) {
      const [oldPRows]: any = await conn.query(
        `SELECT id, is_active, availability_status, assigned_delivery_count, max_active_deliveries 
         FROM delivery_persons WHERE id = ? AND company_id = ? FOR UPDATE`,
        [oldPersonId, company.id]
      );
      if (oldPRows && oldPRows.length > 0) {
        const oldDp = oldPRows[0];
        const newCount = Math.max(0, (Number(oldDp.assigned_delivery_count) || 0) - 1);
        const maxLimit = Number(oldDp.max_active_deliveries) || 3;
        const restoredAvailability =
          oldDp.is_active && newCount < maxLimit && oldDp.availability_status === 'busy'
            ? 'available'
            : oldDp.availability_status;

        await conn.query(
          `UPDATE delivery_persons SET assigned_delivery_count = ?, availability_status = ? WHERE id = ? AND company_id = ?`,
          [newCount, restoredAvailability, oldPersonId, company.id]
        );
      }
    }

    if (targetPersonId) {
      // Fetch new person
      const [newPRows]: any = await conn.query(
        `SELECT id, name, is_active, availability_status, assigned_delivery_count, max_active_deliveries
         FROM delivery_persons WHERE id = ? AND company_id = ? FOR UPDATE`,
        [targetPersonId, company.id]
      );

      if (!newPRows || newPRows.length === 0) {
        return { success: false, error: 'Target delivery person not found' };
      }

      const newDp = newPRows[0];
      if (!newDp.is_active) {
        return { success: false, error: 'Cannot assign delivery to an inactive delivery person.' };
      }

      // If they were assigned to someone else, or this is a fresh assignment:
      if (oldPersonId !== targetPersonId) {
        const updatedCount = (Number(newDp.assigned_delivery_count) || 0) + 1;
        const maxLimit = Number(newDp.max_active_deliveries) || 3;
        const isNowBusy = updatedCount >= maxLimit;

        await conn.query(
          `UPDATE delivery_persons 
           SET assigned_delivery_count = ?, last_assigned_at = NOW(), availability_status = ? 
           WHERE id = ? AND company_id = ?`,
          [updatedCount, isNowBusy ? 'busy' : newDp.availability_status, targetPersonId, company.id]
        );
      }

      // Update delivery
      const nextStatus = current.delivery_status === 'pending' ? 'assigned' : current.delivery_status;
      await conn.query(
        `UPDATE deliveries 
         SET delivery_person_id = ?, assignment_status = 'assigned', delivery_status = ?, assigned_at = COALESCE(assigned_at, NOW()), updated_at = NOW() 
         WHERE id = ? AND company_id = ?`,
        [targetPersonId, nextStatus, deliveryId, company.id]
      );
    } else {
      // Unassigning
      await conn.query(
        `UPDATE deliveries 
         SET delivery_person_id = NULL, assignment_status = 'unassigned', delivery_status = 'pending', assigned_at = NULL, updated_at = NOW() 
         WHERE id = ? AND company_id = ?`,
        [deliveryId, company.id]
      );
    }

    const [updatedRows]: any = await conn.query(
      `SELECT d.*, dp.name AS delivery_person_name, dp.phone AS delivery_person_phone
       FROM deliveries d
       LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
       WHERE d.id = ? AND d.company_id = ?`,
      [deliveryId, company.id]
    );

    return {
      success: true,
      delivery: mapRowToDelivery(updatedRows[0]),
    };
  });
}

/**
 * Update live GPS coordinates for a delivery.
 * Called when rider app/device sends location coordinates.
 */
export async function mysqlUpdateDeliveryLocation(
  deliveryId: string,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; error?: string }> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  try {
    const [result]: any = await pool.query(
      `UPDATE deliveries 
       SET latitude = ?, longitude = ?, location_updated_at = NOW() 
       WHERE id = ?`,
      [latitude, longitude, deliveryId]
    );

    if (result.affectedRows === 0) {
      return { success: false, error: 'Delivery not found' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('mysqlUpdateDeliveryLocation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Public customer tracking lookup by secure tracking_token.
 * Returns safe details without exposing sensitive staff or internal IDs.
 */
export async function mysqlGetDeliveryByTrackingToken(token: string): Promise<any | null> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.company_id, d.bill_id, d.order_source, d.online_order_id, d.tracking_token,
            d.customer_name, d.customer_phone, d.delivery_address,
            d.delivery_status, d.assignment_status, d.order_time,
            d.assigned_at, d.picked_up_at, d.delivered_at, d.delivery_notes, d.status_history,
            d.latitude, d.longitude, d.location_updated_at,
            dp.name AS delivery_person_name, dp.phone AS delivery_person_phone,
            c.name AS company_name, c.phone AS company_phone, c.address AS company_address,
            s.items AS sale_items, s.total AS sale_total, s.tax AS sale_tax, s.discount AS sale_discount, 
            s.payment_method AS sale_payment_method, s.payment_status AS sale_payment_status
     FROM deliveries d
     LEFT JOIN companies c ON d.company_id = c.id
     LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
     LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
     WHERE d.tracking_token = ?
     LIMIT 1`,
    [token]
  );

  if (!rows || rows.length === 0) return null;
  const row = rows[0];

  let statusHistory = [];
  if (row.status_history) {
    try {
      statusHistory = typeof row.status_history === 'string' ? JSON.parse(row.status_history) : row.status_history;
    } catch {
      statusHistory = [];
    }
  }

  let items = [];
  if (row.sale_items) {
    try {
      const raw = typeof row.sale_items === 'string' ? JSON.parse(row.sale_items) : row.sale_items;
      items = raw.map((i: any) => ({
        name: i.product?.name || i.name || 'Item',
        quantity: i.quantity || 1,
        price: i.product?.price || i.price || 0,
      }));
    } catch {
      items = [];
    }
  }

  const phone = row.customer_phone || '';
  const maskedPhone = phone.length > 4 ? '*'.repeat(Math.max(0, phone.length - 4)) + phone.slice(-4) : phone;
  const riderFirstName = row.delivery_person_name ? row.delivery_person_name.split(' ')[0] : null;

  return {
    billId: row.bill_id,
    orderSource: row.order_source || 'Terminal',
    onlineOrderId: row.online_order_id || null,
    trackingToken: row.tracking_token,
    customerName: row.customer_name,
    customerPhoneMasked: maskedPhone,
    deliveryAddress: row.delivery_address,
    deliveryStatus: row.delivery_status || 'pending',
    assignmentStatus: row.assignment_status || 'unassigned',
    orderTime: row.order_time ? new Date(row.order_time).getTime() : null,
    assignedAt: row.assigned_at ? new Date(row.assigned_at).getTime() : null,
    pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at).getTime() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    deliveryNotes: row.delivery_notes,
    statusHistory,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    locationUpdatedAt: row.location_updated_at ? new Date(row.location_updated_at).getTime() : null,
    rider: riderFirstName ? {
      name: riderFirstName,
      phone: row.delivery_person_phone || null,
    } : null,
    company: {
      name: row.company_name || 'Restaurant',
      phone: row.company_phone || '',
      address: row.company_address || '',
    },
    items,
    total: Number(row.sale_total) || 0,
    paymentMethod: row.sale_payment_method || 'Cash',
    paymentStatus: row.sale_payment_status || 'paid',
  };
}

/**
 * Fetch online ordering platform configurations for the authorized company.
 * Automatically ensures default Zomato and Swiggy config entries exist.
 */
export async function mysqlGetOnlineOrderConfigs(): Promise<OnlineOrderConfig[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  // Ensure default rows exist
  await pool.query(
    `INSERT IGNORE INTO online_order_configs (id, company_id, platform, display_name, is_enabled, connection_status)
     VALUES 
      (CONCAT('ooc_', ?, '_zomato'), ?, 'zomato', 'Zomato', 0, 'disconnected'),
      (CONCAT('ooc_', ?, '_swiggy'), ?, 'swiggy', 'Swiggy', 0, 'disconnected')`,
    [company.id, company.id, company.id, company.id]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM online_order_configs WHERE company_id = ? ORDER BY platform ASC',
    [company.id]
  );

  return rows.map(mapRowToOnlineOrderConfig);
}

/**
 * Save or update online ordering platform configuration.
 */
export async function mysqlSaveOnlineOrderConfig(data: {
  platform: string;
  displayName?: string;
  isEnabled: boolean;
  apiKey?: string | null;
  apiSecret?: string | null;
  storeId?: string | null;
  webhookSecret?: string | null;
  autoAccept?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
}): Promise<OnlineOrderConfig> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const id = `ooc_${company.id}_${data.platform}`;
  const displayName = data.displayName || (data.platform === 'zomato' ? 'Zomato' : data.platform === 'swiggy' ? 'Swiggy' : data.platform);
  const status = data.connectionStatus || (data.isEnabled && data.apiKey ? 'connected' : 'disconnected');

  await pool.query(
    `INSERT INTO online_order_configs (
      id, company_id, platform, display_name, is_enabled, api_key, api_secret, store_id, webhook_secret, auto_accept, connection_status, last_sync_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      display_name = VALUES(display_name),
      is_enabled = VALUES(is_enabled),
      api_key = VALUES(api_key),
      api_secret = VALUES(api_secret),
      store_id = VALUES(store_id),
      webhook_secret = VALUES(webhook_secret),
      auto_accept = VALUES(auto_accept),
      connection_status = VALUES(connection_status),
      last_sync_at = NOW(),
      updated_at = NOW()`,
    [
      id,
      company.id,
      data.platform,
      displayName,
      data.isEnabled ? 1 : 0,
      data.apiKey || null,
      data.apiSecret || null,
      data.storeId || null,
      data.webhookSecret || null,
      data.autoAccept !== false ? 1 : 0,
      status,
    ]
  );

  const [rows]: any = await pool.query(
    'SELECT * FROM online_order_configs WHERE company_id = ? AND platform = ?',
    [company.id, data.platform]
  );
  return mapRowToOnlineOrderConfig(rows[0]);
}

/**
 * Concurrency-safe atomic importer for incoming online platform orders (Zomato, Swiggy, Webhooks).
 * Checks idempotency on (company_id, online_order_id) to prevent duplicate bills or orders on API retries.
 */
export async function mysqlImportOnlineOrder(payload: {
  companyId?: string;
  platform: 'Zomato' | 'Swiggy' | string;
  onlineOrderId: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    tax?: number;
    discount?: number;
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
}): Promise<{ success: boolean; sale?: any; delivery?: any; message?: string }> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  let targetCompanyId = payload.companyId;
  if (!targetCompanyId) {
    const compContext = await getAuthorizedCompanyContext();
    targetCompanyId = compContext.id;
  }

  // 1. Idempotency Check: if this platform order was already imported for this company, return existing
  const [existingOrder] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM sales WHERE company_id = ? AND online_order_id = ? LIMIT 1',
    [targetCompanyId, payload.onlineOrderId]
  );

  if (existingOrder && existingOrder.length > 0) {
    const existingSale = mapRowToSale(existingOrder[0]);
    const [delRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM deliveries WHERE company_id = ? AND bill_id = ? LIMIT 1',
      [targetCompanyId, existingSale.billNumber]
    );
    const existingDel = delRows && delRows.length > 0 ? mapRowToDelivery(delRows[0]) : null;
    return {
      success: true,
      sale: existingSale,
      delivery: existingDel,
      message: `Order #${payload.onlineOrderId} was already imported earlier. Returned existing record without duplicates.`,
    };
  }

  // 2. Format items with fallback product details if not matched
  const formattedItems = payload.items.map((i, idx) => ({
    product: {
      id: i.productId || `online_p_${idx}_${Date.now()}`,
      name: i.name,
      price: i.price,
      stock: 999,
      unit: 'plate',
      tax: i.tax || 0,
      discount: i.discount || 0,
    },
    quantity: i.quantity || 1,
  }));

  const nextBill = await mysqlGetNextBillId(targetCompanyId);
  const saleData = {
    id: nextBill.id,
    billNumber: nextBill.id,
    companyId: targetCompanyId,
    orderType: 'Delivery',
    orderSource: payload.platform,
    onlineOrderId: payload.onlineOrderId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone || '',
    deliveryAddress: payload.deliveryAddress,
    deliveryNotes: payload.deliveryNotes,
    items: formattedItems,
    subtotal: payload.subtotal,
    discount: payload.discount || 0,
    tax: payload.tax || 0,
    total: payload.total,
    paymentMethod: payload.paymentMethod || 'Online',
    paymentStatus: payload.paymentStatus || 'paid',
    createdBy: `${payload.platform} API`,
    timestamp: Date.now(),
  };

  const recordResult = await mysqlRecordSale(saleData);
  if (!recordResult.success || !recordResult.sale) {
    throw new Error(recordResult.error || 'Failed to record online platform sale');
  }

  const [delRows] = await pool.query<RowDataPacket[]>(
    `SELECT d.*, dp.name AS delivery_person_name, dp.phone AS delivery_person_phone,
            s.items AS sale_items, s.total AS sale_total, s.payment_method AS sale_payment_method, s.payment_status AS sale_payment_status
     FROM deliveries d
     LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
     LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
     WHERE d.company_id = ? AND d.bill_id = ? LIMIT 1`,
    [targetCompanyId, recordResult.sale.billNumber]
  );
  const delivery = delRows && delRows.length > 0 ? mapRowToDelivery(delRows[0]) : null;

  return {
    success: true,
    sale: recordResult.sale,
    delivery,
    message: `Online order #${payload.onlineOrderId} imported successfully from ${payload.platform}`,
  };
}

/**
 * Taxes & Charges Management
 */
export async function mysqlGetTaxesAndCharges(companyId?: string): Promise<{ taxes: TaxItem[]; charges: ChargeItem[] }> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    try {
      const comp = await getAuthorizedCompanyContext();
      targetCompanyId = comp.id;
    } catch {
      targetCompanyId = 'COMP-0001';
    }
  }

  try {
    const [taxRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM taxes WHERE company_id = ? ORDER BY created_at ASC',
      [targetCompanyId]
    );

    const [chargeRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM charges WHERE company_id = ? ORDER BY created_at ASC',
      [targetCompanyId]
    );

    let taxes: TaxItem[] = [];
    if (taxRows && taxRows.length > 0) {
      taxes = taxRows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        rate: Number(r.rate) || 0,
        appliesTo: r.applies_to || 'Every bill',
        isActive: Boolean(r.is_active),
        createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
      }));
    } else {
      // Seed defaults for this company
      for (const defTax of DEFAULT_TAXES) {
        const tid = `tax_${defTax.name.toLowerCase()}_${targetCompanyId}`;
        await pool.query(
          'INSERT IGNORE INTO taxes (id, company_id, name, rate, applies_to, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [tid, targetCompanyId, defTax.name, defTax.rate, defTax.appliesTo, defTax.isActive ? 1 : 0]
        );
      }
      taxes = DEFAULT_TAXES.map(t => ({ ...t, companyId: targetCompanyId }));
    }

    let charges: ChargeItem[] = [];
    if (chargeRows && chargeRows.length > 0) {
      charges = chargeRows.map((r) => {
        let appliesToArr: string[] = ['Dine In'];
        try {
          if (r.applies_to && r.applies_to.startsWith('[')) {
            appliesToArr = JSON.parse(r.applies_to);
          } else if (r.applies_to) {
            appliesToArr = r.applies_to.split(',').map((s: string) => s.trim());
          }
        } catch {
          appliesToArr = [r.applies_to || 'Dine In'];
        }
        return {
          id: r.id,
          companyId: r.company_id,
          name: r.name,
          type: r.type === 'fixed' ? 'fixed' : 'percentage',
          value: Number(r.value) || 0,
          appliesTo: appliesToArr,
          isActive: Boolean(r.is_active),
          createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
          updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
        };
      });
    } else {
      // Seed default charges for this company
      for (const defCharge of DEFAULT_CHARGES) {
        const cid = `charge_${defCharge.name.toLowerCase().replace(/\s+/g, '_')}_${targetCompanyId}`;
        await pool.query(
          'INSERT IGNORE INTO charges (id, company_id, name, type, value, applies_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [cid, targetCompanyId, defCharge.name, defCharge.type, defCharge.value, defCharge.appliesTo.join(', '), defCharge.isActive ? 1 : 0]
        );
      }
      charges = DEFAULT_CHARGES.map(c => ({ ...c, companyId: targetCompanyId }));
    }

    return { taxes, charges };
  } catch (err) {
    console.warn('Error fetching taxes/charges from MySQL, falling back to defaults:', err);
    return {
      taxes: DEFAULT_TAXES.map(t => ({ ...t, companyId: targetCompanyId })),
      charges: DEFAULT_CHARGES.map(c => ({ ...c, companyId: targetCompanyId })),
    };
  }
}

export async function mysqlSaveTax(tax: { id?: string; name: string; rate: number; appliesTo?: string; isActive?: boolean }, companyId?: string): Promise<TaxItem> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  const id = tax.id || `tax_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const rate = Number(tax.rate) || 0;
  const appliesTo = tax.appliesTo || 'Every bill';
  const isActive = tax.isActive !== false ? 1 : 0;

  await pool.query(
    `INSERT INTO taxes (id, company_id, name, rate, applies_to, is_active)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       rate = VALUES(rate),
       applies_to = VALUES(applies_to),
       is_active = VALUES(is_active),
       updated_at = NOW()`,
    [id, targetCompanyId, tax.name, rate, appliesTo, isActive]
  );

  return {
    id,
    companyId: targetCompanyId,
    name: tax.name,
    rate,
    appliesTo,
    isActive: Boolean(isActive),
  };
}

export async function mysqlToggleTax(id: string, isActive: boolean, companyId?: string): Promise<void> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  await pool.query(
    'UPDATE taxes SET is_active = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
    [isActive ? 1 : 0, id, targetCompanyId]
  );
}

export async function mysqlDeleteTax(id: string, companyId?: string): Promise<void> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  await pool.query('DELETE FROM taxes WHERE id = ? AND company_id = ?', [id, targetCompanyId]);
}

export async function mysqlSaveCharge(charge: { id?: string; name: string; type: 'percentage' | 'fixed'; value: number; appliesTo?: string[]; isActive?: boolean }, companyId?: string): Promise<ChargeItem> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  const id = charge.id || `charge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const value = Number(charge.value) || 0;
  const type = charge.type === 'fixed' ? 'fixed' : 'percentage';
  const appliesToArr = Array.isArray(charge.appliesTo) ? charge.appliesTo : ['Dine In'];
  const appliesToStr = appliesToArr.join(', ');
  const isActive = charge.isActive !== false ? 1 : 0;

  await pool.query(
    `INSERT INTO charges (id, company_id, name, type, value, applies_to, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       type = VALUES(type),
       value = VALUES(value),
       applies_to = VALUES(applies_to),
       is_active = VALUES(is_active),
       updated_at = NOW()`,
    [id, targetCompanyId, charge.name, type, value, appliesToStr, isActive]
  );

  return {
    id,
    companyId: targetCompanyId,
    name: charge.name,
    type,
    value,
    appliesTo: appliesToArr,
    isActive: Boolean(isActive),
  };
}

export async function mysqlToggleCharge(id: string, isActive: boolean, companyId?: string): Promise<void> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  await pool.query(
    'UPDATE charges SET is_active = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
    [isActive ? 1 : 0, id, targetCompanyId]
  );
}

export async function mysqlDeleteCharge(id: string, companyId?: string): Promise<void> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  await pool.query('DELETE FROM charges WHERE id = ? AND company_id = ?', [id, targetCompanyId]);
}

/**
 * WhatsApp Settings Management
 */
export async function mysqlEnsureWhatsAppSettingsTable(): Promise<void> {
  const pool = getMysqlPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      company_id VARCHAR(64) PRIMARY KEY,
      is_enabled TINYINT(1) DEFAULT 1,
      provider VARCHAR(32) DEFAULT 'wa_me',
      api_endpoint VARCHAR(255) NULL,
      api_key TEXT NULL,
      phone_number_id VARCHAR(100) NULL,
      default_country_code VARCHAR(10) DEFAULT '91',
      business_phone VARCHAR(20) NULL,
      auto_open_delivery TINYINT(1) DEFAULT 1,
      send_to_rider TINYINT(1) DEFAULT 0,
      allow_cashier_edit TINYINT(1) DEFAULT 1,
      message_mode VARCHAR(32) DEFAULT 'builder',
      message_format VARCHAR(32) DEFAULT 'short',
      header_text VARCHAR(255) DEFAULT 'Delivery Order #{bill_id} Confirmed!',
      include_store_name TINYINT(1) DEFAULT 0,
      include_order_id TINYINT(1) DEFAULT 1,
      include_channel TINYINT(1) DEFAULT 0,
      include_customer_details TINYINT(1) DEFAULT 0,
      include_customer_phone TINYINT(1) DEFAULT 0,
      include_customer_address TINYINT(1) DEFAULT 0,
      include_customer_notes TINYINT(1) DEFAULT 0,
      include_staff_details TINYINT(1) DEFAULT 1,
      include_items TINYINT(1) DEFAULT 0,
      include_item_prices TINYINT(1) DEFAULT 0,
      include_total TINYINT(1) DEFAULT 0,
      include_payment_method TINYINT(1) DEFAULT 0,
      include_tracking_link TINYINT(1) DEFAULT 1,
      footer_text TEXT NULL,
      custom_template TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  try {
    const [cols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_settings' AND COLUMN_NAME = 'message_format'`
    );
    if (!cols || cols.length === 0) {
      await pool.query(`ALTER TABLE whatsapp_settings ADD COLUMN message_format VARCHAR(32) DEFAULT 'paragraph' AFTER message_mode`);
    }

    const [paraCols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_settings' AND COLUMN_NAME = 'paragraph_greeting'`
    );
    if (!paraCols || paraCols.length === 0) {
      await pool.query(`ALTER TABLE whatsapp_settings ADD COLUMN paragraph_greeting TEXT NULL AFTER header_text`);
    }
  } catch {}
}

export async function mysqlGetWhatsAppSettings(companyId?: string): Promise<WhatsAppSettings> {
  await ensureLocalMySqlInitialized();
  await mysqlEnsureWhatsAppSettingsTable();
  const pool = getMysqlPool();
  let targetCompanyId = companyId;
  if (!targetCompanyId) {
    try {
      const comp = await getAuthorizedCompanyContext();
      targetCompanyId = comp.id;
    } catch {
      targetCompanyId = 'COMP-0001';
    }
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM whatsapp_settings WHERE company_id = ? LIMIT 1',
      [targetCompanyId]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        companyId: r.company_id,
        isEnabled: Boolean(r.is_enabled),
        provider: r.provider || 'wa_me',
        apiEndpoint: r.api_endpoint || '',
        apiKey: r.api_key || '',
        phoneNumberId: r.phone_number_id || '',
        defaultCountryCode: r.default_country_code || '91',
        businessPhone: r.business_phone || '',
        autoOpenDelivery: Boolean(r.auto_open_delivery),
        sendToRider: Boolean(r.send_to_rider),
        allowCashierEdit: Boolean(r.allow_cashier_edit),
        messageMode: r.message_mode || 'builder',
        messageFormat: r.message_format || 'paragraph',
        paragraphGreeting: r.paragraph_greeting !== null && r.paragraph_greeting !== undefined ? r.paragraph_greeting : DEFAULT_WHATSAPP_SETTINGS.paragraphGreeting,
        headerText: r.header_text !== null && r.header_text !== undefined ? r.header_text : DEFAULT_WHATSAPP_SETTINGS.headerText,
        includeStoreName: Boolean(r.include_store_name),
        includeOrderId: Boolean(r.include_order_id),
        includeChannel: Boolean(r.include_channel),
        includeCustomerDetails: Boolean(r.include_customer_details),
        includeCustomerPhone: Boolean(r.include_customer_phone),
        includeCustomerAddress: Boolean(r.include_customer_address),
        includeCustomerNotes: Boolean(r.include_customer_notes),
        includeStaffDetails: Boolean(r.include_staff_details),
        includeItems: Boolean(r.include_items),
        includeItemPrices: Boolean(r.include_item_prices),
        includeTotal: Boolean(r.include_total),
        includePaymentMethod: Boolean(r.include_payment_method),
        includeTrackingLink: Boolean(r.include_tracking_link),
        footerText: r.footer_text !== null && r.footer_text !== undefined ? r.footer_text : DEFAULT_WHATSAPP_SETTINGS.footerText,
        customTemplate: r.custom_template || DEFAULT_WHATSAPP_SETTINGS.customTemplate,
      };
    }

    return {
      ...DEFAULT_WHATSAPP_SETTINGS,
      companyId: targetCompanyId,
    };
  } catch (err) {
    console.warn('mysqlGetWhatsAppSettings error:', err);
    return {
      ...DEFAULT_WHATSAPP_SETTINGS,
      companyId: targetCompanyId,
    };
  }
}

export async function mysqlSaveWhatsAppSettings(
  settings: Partial<WhatsAppSettings>,
  companyId?: string
): Promise<WhatsAppSettings> {
  await ensureLocalMySqlInitialized();
  await mysqlEnsureWhatsAppSettingsTable();
  const pool = getMysqlPool();
  let targetCompanyId = companyId || settings.companyId;
  if (!targetCompanyId) {
    const comp = await getAuthorizedCompanyContext();
    targetCompanyId = comp.id;
  }

  const merged: WhatsAppSettings = {
    ...DEFAULT_WHATSAPP_SETTINGS,
    ...settings,
    companyId: targetCompanyId,
  };

  await pool.query(
    `INSERT INTO whatsapp_settings (
      company_id, is_enabled, provider, api_endpoint, api_key, phone_number_id,
      default_country_code, business_phone, auto_open_delivery, send_to_rider,
      allow_cashier_edit, message_mode, message_format, paragraph_greeting, header_text, include_store_name,
      include_order_id, include_channel, include_customer_details, include_customer_phone,
      include_customer_address, include_customer_notes, include_staff_details,
      include_items, include_item_prices, include_total, include_payment_method,
      include_tracking_link, footer_text, custom_template, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, NOW()
    ) ON DUPLICATE KEY UPDATE
      is_enabled = VALUES(is_enabled),
      provider = VALUES(provider),
      api_endpoint = VALUES(api_endpoint),
      api_key = VALUES(api_key),
      phone_number_id = VALUES(phone_number_id),
      default_country_code = VALUES(default_country_code),
      business_phone = VALUES(business_phone),
      auto_open_delivery = VALUES(auto_open_delivery),
      send_to_rider = VALUES(send_to_rider),
      allow_cashier_edit = VALUES(allow_cashier_edit),
      message_mode = VALUES(message_mode),
      message_format = VALUES(message_format),
      paragraph_greeting = VALUES(paragraph_greeting),
      header_text = VALUES(header_text),
      include_store_name = VALUES(include_store_name),
      include_order_id = VALUES(include_order_id),
      include_channel = VALUES(include_channel),
      include_customer_details = VALUES(include_customer_details),
      include_customer_phone = VALUES(include_customer_phone),
      include_customer_address = VALUES(include_customer_address),
      include_customer_notes = VALUES(include_customer_notes),
      include_staff_details = VALUES(include_staff_details),
      include_items = VALUES(include_items),
      include_item_prices = VALUES(include_item_prices),
      include_total = VALUES(include_total),
      include_payment_method = VALUES(include_payment_method),
      include_tracking_link = VALUES(include_tracking_link),
      footer_text = VALUES(footer_text),
      custom_template = VALUES(custom_template),
      updated_at = NOW()`,
    [
      targetCompanyId,
      merged.isEnabled ? 1 : 0,
      merged.provider || 'wa_me',
      merged.apiEndpoint || null,
      merged.apiKey || null,
      merged.phoneNumberId || null,
      merged.defaultCountryCode || '91',
      merged.businessPhone || null,
      merged.autoOpenDelivery ? 1 : 0,
      merged.sendToRider ? 1 : 0,
      merged.allowCashierEdit ? 1 : 0,
      merged.messageMode || 'builder',
      merged.messageFormat || 'paragraph',
      merged.paragraphGreeting ?? DEFAULT_WHATSAPP_SETTINGS.paragraphGreeting,
      merged.headerText ?? DEFAULT_WHATSAPP_SETTINGS.headerText,
      merged.includeStoreName ? 1 : 0,
      merged.includeOrderId ? 1 : 0,
      merged.includeChannel ? 1 : 0,
      merged.includeCustomerDetails ? 1 : 0,
      merged.includeCustomerPhone ? 1 : 0,
      merged.includeCustomerAddress ? 1 : 0,
      merged.includeCustomerNotes ? 1 : 0,
      merged.includeStaffDetails ? 1 : 0,
      merged.includeItems ? 1 : 0,
      merged.includeItemPrices ? 1 : 0,
      merged.includeTotal ? 1 : 0,
      merged.includePaymentMethod ? 1 : 0,
      merged.includeTrackingLink ? 1 : 0,
      merged.footerText ?? DEFAULT_WHATSAPP_SETTINGS.footerText,
      merged.customTemplate ?? DEFAULT_WHATSAPP_SETTINGS.customTemplate,
    ]
  );

  return merged;
}



