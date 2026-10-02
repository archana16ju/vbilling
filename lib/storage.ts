'use server'

import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

let Database: any = null;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn("Native better-sqlite3 failed to load. Offline SQLite will be disabled.");
}


export interface StorageConfig {
  location: string;
}

let dbInstance: any = null;

function getDbInstance(location: string) {
  if (dbInstance) return dbInstance;
  if (!Database) {
    // Graceful fallback to prevent crashes if native module is broken
    return {
      pragma: () => {},
      exec: () => {},
      prepare: () => ({ all: () => [], get: () => ({ c: 0 }), run: () => {} }),
      transaction: (fn: any) => fn
    };
  }
  
  const dbDir = path.join(location, 'database');
  if (!fsSync.existsSync(dbDir)) {
    fsSync.mkdirSync(dbDir, { recursive: true });
  }
  try {
    dbInstance = new Database(path.join(dbDir, 'local_storage.db'));
    dbInstance.pragma('journal_mode = WAL');
  } catch (e) {
    console.error("Failed to initialize Database:", e);
    Database = null; // Disable and return mock
    return {
      pragma: () => {},
      exec: () => {},
      prepare: () => ({ all: () => [], get: () => ({ c: 0 }), run: () => {} }),
      transaction: (fn: any) => fn
    };
  }
  
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS offline_bills (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payment_method TEXT,
        total REAL,
        sync_status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image TEXT
      );
      CREATE TABLE IF NOT EXISTS local_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        quantityStep INTEGER DEFAULT 1,
        recipeYield REAL,
        recipeUnit TEXT,
        rawMaterials TEXT
      );
      CREATE TABLE IF NOT EXISTS local_raw_materials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        currentStock REAL NOT NULL,
        minimumStock REAL NOT NULL,
        isActive INTEGER NOT NULL,
        lastUpdated INTEGER
      );
      CREATE TABLE IF NOT EXISTS local_stock_transactions (
        id TEXT PRIMARY KEY,
        rawMaterialId TEXT NOT NULL,
        type TEXT NOT NULL,
        quantityBefore REAL NOT NULL,
        quantityChanged REAL NOT NULL,
        quantityAfter REAL NOT NULL,
        date INTEGER NOT NULL,
        reason TEXT,
        referenceId TEXT
      );
      CREATE TABLE IF NOT EXISTS dashboard_sync_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL
      );
    `);
    
    // Safe migrations for existing DBs
    try { dbInstance.exec("ALTER TABLE local_products ADD COLUMN recipeYield REAL;"); } catch (e) {}
    try { dbInstance.exec("ALTER TABLE local_products ADD COLUMN recipeUnit TEXT;"); } catch (e) {}
    try { dbInstance.exec("ALTER TABLE local_products ADD COLUMN rawMaterials TEXT;"); } catch (e) {}
  } catch (e) {
    console.error("Failed to initialize database tables:", e);
    Database = null; // Disable and return mock
    return {
      pragma: () => {},
      exec: () => {},
      prepare: () => ({ all: () => [], get: () => ({ c: 0 }), run: () => {} }),
      transaction: (fn: any) => fn
    };
  }
  
  return dbInstance;
}

async function migrateJsonToSqlite(location: string) {
  const pendingBillsDir = path.join(location, 'offline', 'pending-bills');
  try {
    if (!fsSync.existsSync(pendingBillsDir)) return;
    const files = await fs.readdir(pendingBillsDir);
    const db = getDbInstance(location);
    
    const insert = db.prepare(`
      INSERT OR IGNORE INTO offline_bills (id, data, timestamp, payment_method, total, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((bills: any[]) => {
      for (const bill of bills) {
        insert.run(
          bill.id,
          JSON.stringify(bill),
          bill.timestamp || Date.now(),
          bill.paymentMethod || 'Cash',
          bill.total || 0,
          'PENDING_SYNC'
        );
      }
    });

    const billsToMigrate = [];
    const filesToDelete = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(pendingBillsDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const bill = JSON.parse(data);
        billsToMigrate.push(bill);
        filesToDelete.push(filePath);
      }
    }
    
    if (billsToMigrate.length > 0) {
      insertMany(billsToMigrate);
      // Clean up files
      for (const f of filesToDelete) {
        await fs.unlink(f);
      }
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const legacyConfig = path.join(os.homedir(), '.billing-software', 'storage-config.json');
  const newConfig = process.env.OFFLINE_STORAGE_PATH ? path.join(process.env.OFFLINE_STORAGE_PATH, 'storage-config.json') : null;

  try {
    if (newConfig && fsSync.existsSync(newConfig)) {
      const data = await fs.readFile(newConfig, 'utf8');
      return JSON.parse(data);
    }
    const data = await fs.readFile(legacyConfig, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Priority 1: Electron User Data Path. Priority 2: Fallback to homedir.
    if (process.env.OFFLINE_STORAGE_PATH) {
      return { location: process.env.OFFLINE_STORAGE_PATH };
    }
    return { location: path.join(os.homedir(), '.billing-software', 'BillingOfflineStorage') };
  }
}

export async function setStorageLocation(newLocation: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate path is absolute and writable
    if (!path.isAbsolute(newLocation)) {
      return { success: false, error: 'Path must be absolute.' };
    }
    
    // Create base dir if not exists
    await fs.mkdir(newLocation, { recursive: true });
    
    // Create config dir if not exists
    const configPath = process.env.OFFLINE_STORAGE_PATH ? path.join(process.env.OFFLINE_STORAGE_PATH, 'storage-config.json') : path.join(os.homedir(), '.billing-software', 'storage-config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    await fs.writeFile(configPath, JSON.stringify({ location: newLocation }));
    
    // reset db instance to let it reinitialize at new location
    dbInstance = null;
    await ensureStorageDirectories(newLocation);
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ensureStorageDirectories(basePath?: string) {
  const location = basePath || (await getStorageConfig()).location;
  
  const dirs = [
    path.join(location, 'cache', 'products', 'images'),
    path.join(location, 'cache', 'categories', 'images'),
    path.join(location, 'offline', 'pending-bills'),
    path.join(location, 'sync', 'queue'),
    path.join(location, 'metadata'),
    path.join(location, 'database'),
    path.join(location, 'updates')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      console.warn(`Failed to create directory ${dir}:`, e);
    }
  }
  
  await migrateJsonToSqlite(location);
  
  // Clean up any previously completed bills to free up space
  try {
    const db = getDbInstance(location);
    db.prepare(`DELETE FROM offline_bills WHERE sync_status = 'COMPLETED'`).run();
  } catch (e) {
    console.error('Cleanup failed:', e);
  }
  
  return location;
}

export async function getStoragePaths() {
  const location = await ensureStorageDirectories();
  return {
    base: location,
    productImages: path.join(location, 'cache', 'products', 'images'),
    categoryImages: path.join(location, 'cache', 'categories', 'images'),
    pendingBills: path.join(location, 'offline', 'pending-bills'),
    syncQueue: path.join(location, 'sync', 'queue'),
    database: path.join(location, 'database', 'local_storage.db')
  };
}

async function getDirSize(dirPath: string): Promise<number> {
  try {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
    return size;
  } catch {
    return 0;
  }
}

async function countFiles(dirPath: string): Promise<number> {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files.filter(f => f.isFile()).length;
  } catch {
    return 0;
  }
}

export async function getStorageStats() {
  const paths = await getStoragePaths();
  
  const [productImgs, categoryImgs, totalSize, productImgsSize, categoryImgsSize, pendingBillsSize, syncQueueSize] = await Promise.all([
    countFiles(paths.productImages),
    countFiles(paths.categoryImages),
    getDirSize(paths.base),
    getDirSize(paths.productImages),
    getDirSize(paths.categoryImages),
    getDirSize(paths.pendingBills),
    getDirSize(paths.syncQueue)
  ]);

  let totalOfflineBillsCount = 0;
  let pendingSyncCount = 0;
  let completedCount = 0;
  let databaseSizeBytes = 0;

  try {
    const db = getDbInstance(paths.base);
    totalOfflineBillsCount = db.prepare(`SELECT COUNT(*) as c FROM offline_bills`).get().c;
    pendingSyncCount = db.prepare(`SELECT COUNT(*) as c FROM offline_bills WHERE sync_status = 'PENDING_SYNC'`).get().c;
    completedCount = totalOfflineBillsCount - pendingSyncCount;
    
    if (fsSync.existsSync(paths.database)) {
      const stat = await fs.stat(paths.database);
      databaseSizeBytes = stat.size;
    }
  } catch (e) {
    console.error('Error fetching db stats', e);
  }

  const dashboardStats = await getDashboardOfflineStats();
  const cachedImagesList = await getCachedImagesList();

  const folderDetails = [
    { name: 'Database (SQLite)', path: paths.database, sizeBytes: databaseSizeBytes, type: 'Permanent Data' },
    { name: 'Product Images', path: paths.productImages, sizeBytes: productImgsSize, type: 'Permanent Data' },
    { name: 'Category Images', path: paths.categoryImages, sizeBytes: categoryImgsSize, type: 'Permanent Data' },
    { name: 'Offline Bills Temp', path: paths.pendingBills, sizeBytes: pendingBillsSize, type: 'Temporary Cache' },
    { name: 'Sync Queue Temp', path: paths.syncQueue, sizeBytes: syncQueueSize, type: 'Temporary Cache' },
  ];

  return {
    location: paths.base,
    databaseLocation: paths.database,
    usedBytes: totalSize,
    folderDetails,
    cachedProductImagesCount: productImgs,
    cachedCategoryImagesCount: categoryImgs,
    cachedImagesList,
    pendingBillsCount: pendingSyncCount,
    totalOfflineBillsCount,
    pendingSyncItemsCount: pendingSyncCount,
    completedCount,
    databaseSizeBytes,
    dashboardPendingSyncs: dashboardStats.pendingSyncs,
    dashboardOfflineProducts: dashboardStats.offlineProducts,
    dashboardOfflineCategories: dashboardStats.offlineCategories
  };
}

export async function clearCache() {
  const paths = await getStoragePaths();
  
  const cacheDirs = [
    paths.productImages,
    paths.categoryImages
  ];

  for (const dir of cacheDirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }
    } catch (e) {
      console.error('Failed to clear cache dir', dir, e);
    }
  }
  
  return { success: true };
}

export async function resetStorage() {
  const defaultPath = path.join(os.homedir(), '.billing-software', 'BillingOfflineStorage');
  return setStorageLocation(defaultPath);
}

export async function getPendingBills() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const rows = db.prepare(`SELECT data FROM offline_bills WHERE sync_status = 'PENDING_SYNC'`).all();
    return rows.map((r: any) => JSON.parse(r.data));
  } catch (e) {
    console.error('getPendingBills error', e);
    return [];
  }
}

export async function getAllLocalBills() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const rows = db.prepare(`SELECT * FROM offline_bills ORDER BY timestamp DESC`).all();
    return rows.map((r: any) => ({
      id: r.id,
      data: JSON.parse(r.data),
      timestamp: r.timestamp,
      payment_method: r.payment_method,
      total: r.total,
      sync_status: r.sync_status
    }));
  } catch (e) {
    console.error('getAllLocalBills error', e);
    return [];
  }
}

export async function savePendingBill(bill: any) {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO offline_bills (id, data, timestamp, payment_method, total, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(
      bill.id,
      JSON.stringify(bill),
      bill.timestamp || Date.now(),
      bill.paymentMethod || 'Cash',
      bill.total || 0,
      'PENDING_SYNC'
    );

    // Deduct offline stock
    try {
      const { calculateRecipeDeduction, processStockTransactions } = await import('@/lib/actions/inventory');
      const allRawMaterials = await getLocalRawMaterials();
      const stockTxs = [];
      const dbProducts = getLocalProductsSync(db); // I need a sync local products fetcher or I can use the existing rows if passed, or await getLocalProducts()

      for (const item of bill.items) {
        db.prepare('UPDATE local_products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product.id);
        
        // Use the product snapshot in the cart, but it might not have rawMaterials unless we saved it.
        // The bill.items.product should contain the full product if the cart saved it.
        const productToUse = item.product;
        if (productToUse.rawMaterials && productToUse.rawMaterials.length > 0) {
          const deductions = await calculateRecipeDeduction(productToUse.rawMaterials, item.quantity, allRawMaterials);
          for (const d of deductions) {
            stockTxs.push({
              rawMaterialId: d.materialId,
              type: 'Stock Deduction',
              quantityBefore: 0,
              quantityChanged: -d.quantityToDeduct,
              quantityAfter: 0,
              reason: `Offline Sale ${bill.id}`,
              referenceId: bill.id
            });
          }
        }
      }
      
      if (stockTxs.length > 0) {
        await processStockTransactions(stockTxs as any, false);
      }
    } catch (invErr) {
      console.error('Offline inventory deduction failed', invErr);
    }
  } catch (e) {
    console.error('savePendingBill error', e);
  }
}

function getLocalProductsSync(db: any) {
  try {
    const rows = db.prepare('SELECT * FROM local_products').all();
    return rows.map((r: any) => ({
      ...r,
      categoryId: r.category,
      rawMaterials: r.rawMaterials ? JSON.parse(r.rawMaterials) : undefined
    }));
  } catch(e) { return []; }
}

export async function deletePendingBill(billId: string) {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const del = db.prepare(`
      DELETE FROM offline_bills WHERE id = ?
    `);
    del.run(billId);
  } catch (e) {
    console.error('deletePendingBill error', e);
  }
}

// --- Dashboard Offline Methods ---

export async function getLocalProducts() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const rows = db.prepare('SELECT * FROM local_products').all();
    return rows.map((r: any) => ({
      ...r,
      categoryId: r.category,
      rawMaterials: r.rawMaterials ? JSON.parse(r.rawMaterials) : undefined
    }));
  } catch (e) {
    return [];
  }
}

export async function getLocalRawMaterials() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const rows = db.prepare('SELECT * FROM local_raw_materials').all();
    return rows.map((r: any) => ({
      ...r,
      isActive: r.isActive === 1
    }));
  } catch (e) {
    return [];
  }
}

export async function getLocalStockTransactions() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    return db.prepare('SELECT * FROM local_stock_transactions ORDER BY date DESC').all();
  } catch (e) {
    return [];
  }
}

export async function getLocalCategories() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    return db.prepare('SELECT * FROM local_categories').all();
  } catch (e) {
    return [];
  }
}

export async function getCachedImagesList() {
  const paths = await getStoragePaths();
  try {
    const pFiles = await fs.readdir(paths.productImages, { withFileTypes: true });
    const cFiles = await fs.readdir(paths.categoryImages, { withFileTypes: true });
    
    const products = await Promise.all(pFiles.filter(f => f.isFile()).map(async f => {
      const stats = await fs.stat(path.join(paths.productImages, f.name));
      return { name: f.name, size: stats.size, type: 'product', path: path.join(paths.productImages, f.name) };
    }));
    
    const categories = await Promise.all(cFiles.filter(f => f.isFile()).map(async f => {
      const stats = await fs.stat(path.join(paths.categoryImages, f.name));
      return { name: f.name, size: stats.size, type: 'category', path: path.join(paths.categoryImages, f.name) };
    }));

    return [...products, ...categories];
  } catch (e) {
    return [];
  }
}

export async function cacheDashboardData(type: 'PRODUCT' | 'CATEGORY' | 'RAWMATERIAL' | 'STOCKTX', items: any[]) {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    let insert: any;
    if (type === 'PRODUCT') {
      insert = db.prepare('INSERT OR REPLACE INTO local_products (id, name, price, stock, category, image, quantityStep, recipeYield, recipeUnit, rawMaterials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    } else if (type === 'CATEGORY') {
      insert = db.prepare('INSERT OR REPLACE INTO local_categories (id, name, image) VALUES (?, ?, ?)');
    } else if (type === 'RAWMATERIAL') {
      insert = db.prepare('INSERT OR REPLACE INTO local_raw_materials (id, name, unit, currentStock, minimumStock, isActive, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?)');
    } else if (type === 'STOCKTX') {
      insert = db.prepare('INSERT OR REPLACE INTO local_stock_transactions (id, rawMaterialId, type, quantityBefore, quantityChanged, quantityAfter, date, reason, referenceId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    }

    const transaction = db.transaction((itemsList: any[]) => {
      for (const item of itemsList) {
        if (type === 'PRODUCT') {
          insert.run(
            item._id || item.id, item.name, item.price, item.stock, item.categoryId || item.category, item.image || null, item.quantityStep || 1,
            item.recipeYield || null, item.recipeUnit || null, item.rawMaterials ? JSON.stringify(item.rawMaterials) : null
          );
        } else if (type === 'CATEGORY') {
          insert.run(item._id || item.id, item.name, item.image || null);
        } else if (type === 'RAWMATERIAL') {
          insert.run(item._id || item.id, item.name, item.unit, item.currentStock, item.minimumStock, item.isActive ? 1 : 0, item.lastUpdated || Date.now());
        } else if (type === 'STOCKTX') {
          insert.run(item._id || item.id, item.rawMaterialId, item.type, item.quantityBefore, item.quantityChanged, item.quantityAfter, item.date || Date.now(), item.reason || null, item.referenceId || null);
        }
      }
    });
    transaction(items);
  } catch (e) {
    console.error('Failed to cache dashboard data', e);
  }
}

export async function removeLocalDashboardData(type: 'PRODUCT' | 'CATEGORY', id: string) {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    if (type === 'PRODUCT') {
      db.prepare('DELETE FROM local_products WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM local_categories WHERE id = ?').run(id);
    }
  } catch (e) {
    console.error('Failed to remove local dashboard data', e);
  }
}

export async function addDashboardSyncAction(action: 'CREATE' | 'UPDATE' | 'DELETE', entityType: 'CATEGORY' | 'PRODUCT', entityId: string, data: any) {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const insert = db.prepare(`
      INSERT INTO dashboard_sync_queue (id, action, entity_type, entity_id, data, timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(
      `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      entityType,
      entityId,
      JSON.stringify(data),
      Date.now(),
      'PENDING'
    );
    
    // Also update local cache
    if (entityType === 'CATEGORY') {
      if (action === 'DELETE') {
        db.prepare('DELETE FROM local_categories WHERE id = ?').run(entityId);
      } else {
        db.prepare('INSERT OR REPLACE INTO local_categories (id, name, image) VALUES (?, ?, ?)')
          .run(entityId, data.name, data.image || null);
      }
    } else if (entityType === 'PRODUCT') {
      if (action === 'DELETE') {
        db.prepare('DELETE FROM local_products WHERE id = ?').run(entityId);
      } else {
        db.prepare('INSERT OR REPLACE INTO local_products (id, name, price, stock, category, image, quantityStep) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(entityId, data.name, data.price, data.stock, data.categoryId || data.category, data.image || null, data.quantityStep || 1);
      }
    }
    
    return true;
  } catch (e) {
    console.error('addDashboardSyncAction error', e);
    return false;
  }
}

export async function getDashboardSyncQueue() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    return db.prepare(`SELECT * FROM dashboard_sync_queue ORDER BY timestamp ASC`).all();
  } catch (e) {
    return [];
  }
}

export async function updateDashboardSyncStatus(id: string, status: 'SYNCED' | 'FAILED') {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    db.prepare('UPDATE dashboard_sync_queue SET status = ? WHERE id = ?').run(status, id);
  } catch (e) {
    console.error('updateDashboardSyncStatus error', e);
  }
}

export async function getDashboardOfflineStats() {
  const paths = await getStoragePaths();
  try {
    const db = getDbInstance(paths.base);
    const pendingSyncs = db.prepare(`SELECT COUNT(*) as c FROM dashboard_sync_queue WHERE status = 'PENDING'`).get().c;
    const offlineProducts = db.prepare(`SELECT COUNT(*) as c FROM local_products`).get().c;
    const offlineCategories = db.prepare(`SELECT COUNT(*) as c FROM local_categories`).get().c;
    return { pendingSyncs, offlineProducts, offlineCategories };
  } catch (e) {
    return { pendingSyncs: 0, offlineProducts: 0, offlineCategories: 0 };
  }
}

export async function getPendingOfflineBills() {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  return db.prepare("SELECT * FROM offline_bills WHERE sync_status = 'PENDING_SYNC'").all();
}

export async function markOfflineBillSynced(id: string) {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  db.prepare("UPDATE offline_bills SET sync_status = 'COMPLETED' WHERE id = ?").run(id);
}

export async function getPendingDashboardActions() {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  return db.prepare("SELECT * FROM dashboard_sync_queue WHERE status = 'PENDING' ORDER BY timestamp ASC").all();
}

export async function removeDashboardAction(id: string) {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  db.prepare("DELETE FROM dashboard_sync_queue WHERE id = ?").run(id);
}

export async function getPendingOfflineBillsCount(): Promise<number> {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  return db.prepare(`SELECT COUNT(*) as c FROM offline_bills WHERE sync_status = 'PENDING_SYNC'`).get().c;
}

export async function verifyOfflineBillsTable(): Promise<boolean> {
  const paths = await getStoragePaths();
  const db = getDbInstance(paths.base);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[];
  return tables.some(t => t.name === 'offline_bills');
}
