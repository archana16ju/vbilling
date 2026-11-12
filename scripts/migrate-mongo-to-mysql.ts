import mysql from 'mysql2/promise';
import { MongoClient, GridFSBucket } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vseyal_team:hTdWg5Rp6XEePqdu@cluster0.pcmcfdv.mongodb.net/skbriyani?appName=Cluster0';
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'billing_user',
  password: process.env.MYSQL_PASSWORD || 'Billing@2026!Secure',
  database: process.env.MYSQL_DATABASE || 'local_billing_db',
};

const TARGET_COMPANY_ID = 'comp_default';

async function migrate() {
  console.log('=== Starting MongoDB to MySQL Full Migration ===');
  console.log('MongoDB URI:', MONGODB_URI.replace(/:([^@]+)@/, ':***@'));
  console.log('MySQL Target:', `${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);

  // 1. Connect MongoDB
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  console.log('Connected to MongoDB Atlas');
  const mongoDb = mongoClient.db('skbriyani');

  // 2. Connect MySQL
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  console.log('Connected to MySQL local_billing_db');

  try {
    // 3. Ensure Company & Permissions
    console.log('\n--- 1. Ensuring Company & Permissions ---');
    await mysqlConn.query(`
      INSERT INTO companies (id, name, code, address, phone, email, currency, is_active)
      VALUES (?, 'SK Biryani', 'SKB', '123 Main Street', '9876543210', 'store@example.com', 'INR', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1
    `, [TARGET_COMPANY_ID]);

    // Also insert COMP-0001 as alias just in case
    await mysqlConn.query(`
      INSERT INTO companies (id, name, code, address, phone, email, currency, is_active)
      VALUES ('COMP-0001', 'SK Biryani', 'SKB', '123 Main Street', '9876543210', 'store@example.com', 'INR', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1
    `);

    // Ensure permissions
    for (const compId of [TARGET_COMPANY_ID, 'COMP-0001']) {
      await mysqlConn.query(`
        INSERT INTO company_permissions (
          id, company_id, module_users, module_products, module_categories, module_sales,
          module_bills, module_customers, module_payments, module_inventory,
          module_raw_materials, module_reports, module_settings
        ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE module_products = 1, module_categories = 1, module_sales = 1, module_bills = 1
      `, [`cp_${compId}`, compId]);
    }

    // Ensure users
    console.log('\n--- 2. Ensuring Users & Company Assignments ---');
    await mysqlConn.query(`
      INSERT INTO users (id, name, username, email, password, role, company_id, is_active)
      VALUES 
        ('u1', 'Administrator', 'admin', 'admin@local.test', 'admin', 'company_admin', ?, 1),
        ('u2', 'Cashier User', 'cashier', 'cashier@local.test', 'cashier123', 'cashier', ?, 1)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        password = VALUES(password),
        role = VALUES(role),
        company_id = VALUES(company_id),
        is_active = 1
    `, [TARGET_COMPANY_ID, TARGET_COMPANY_ID]);

    await mysqlConn.query(`
      INSERT INTO user_companies (id, user_id, company_id, role)
      VALUES 
        ('uc_admin_default', 'u1', ?, 'company_admin'),
        ('uc_cashier_default', 'u2', ?, 'cashier')
      ON DUPLICATE KEY UPDATE role = VALUES(role)
    `, [TARGET_COMPANY_ID, TARGET_COMPANY_ID]);

    // 4. Migrate GridFS Images
    console.log('\n--- 3. Migrating Media from GridFS to Local Storage ---');
    const storageDirs = [
      path.join(process.env.HOME || '/home/ubuntu', '.billing-software', 'BillingOfflineStorage', 'cache', 'products', 'images'),
      path.join(process.env.HOME || '/home/ubuntu', '.billing-software', 'BillingOfflineStorage', 'cache', 'categories', 'images'),
      path.join(process.cwd(), 'public', 'media')
    ];
    for (const dir of storageDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    try {
      const bucket = new GridFSBucket(mongoDb, { bucketName: 'images' });
      const imageFiles = await bucket.find().toArray();
      console.log(`Found ${imageFiles.length} images in GridFS`);

      for (const img of imageFiles) {
        const filename = img.filename;
        const targetDir = filename.startsWith('category-')
          ? storageDirs[1]
          : storageDirs[0];
        const destPath = path.join(targetDir, filename);
        const publicDestPath = path.join(storageDirs[2], filename);

        // Download stream
        const downloadStream = bucket.openDownloadStreamByName(filename);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          downloadStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
          downloadStream.on('error', reject);
          downloadStream.on('end', () => resolve());
        });

        const buf = Buffer.concat(chunks);
        fs.writeFileSync(destPath, buf);
        fs.writeFileSync(publicDestPath, buf);
      }
      console.log(`Successfully extracted ${imageFiles.length} images to local disk.`);
    } catch (e: any) {
      console.warn('GridFS extraction warning:', e.message);
    }

    // 5. Migrate Categories
    console.log('\n--- 4. Migrating Categories ---');
    const mongoCategories = await mongoDb.collection('categories').find().toArray();
    console.log(`Found ${mongoCategories.length} categories in MongoDB`);

    let catCount = 0;
    for (const cat of mongoCategories) {
      const catId = cat.id || cat._id.toString();
      await mysqlConn.query(`
        INSERT INTO categories (id, company_id, name, image)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          name = VALUES(name),
          image = VALUES(image)
      `, [catId, TARGET_COMPANY_ID, cat.name, cat.image || null]);
      catCount++;
    }
    console.log(`Migrated ${catCount} categories into MySQL.`);

    // 6. Migrate Products
    console.log('\n--- 5. Migrating Products ---');
    const mongoProducts = await mongoDb.collection('products').find().toArray();
    console.log(`Found ${mongoProducts.length} products in MongoDB`);

    let prodCount = 0;
    for (const prod of mongoProducts) {
      const prodId = prod.id || prod._id.toString();
      const rawMaterialsJson = prod.rawMaterials
        ? JSON.stringify(prod.rawMaterials)
        : null;

      await mysqlConn.query(`
        INSERT INTO products (
          id, company_id, name, sku, barcode, price, stock, unit,
          quantity_step, category_id, image, tax, discount, min_stock,
          supplier_name, recipe_yield, recipe_unit, raw_materials_json,
          is_batch_tracked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          name = VALUES(name),
          sku = VALUES(sku),
          barcode = VALUES(barcode),
          price = VALUES(price),
          stock = VALUES(stock),
          unit = VALUES(unit),
          quantity_step = VALUES(quantity_step),
          category_id = VALUES(category_id),
          image = VALUES(image),
          tax = VALUES(tax),
          discount = VALUES(discount),
          min_stock = VALUES(min_stock),
          supplier_name = VALUES(supplier_name),
          recipe_yield = VALUES(recipe_yield),
          recipe_unit = VALUES(recipe_unit),
          raw_materials_json = VALUES(raw_materials_json),
          is_batch_tracked = VALUES(is_batch_tracked)
      `, [
        prodId,
        TARGET_COMPANY_ID,
        prod.name,
        prod.sku || null,
        prod.barcode || null,
        Number(prod.price) || 0,
        Number(prod.stock) || 0,
        prod.unit || 'plate',
        Number(prod.quantityStep) || 1,
        prod.categoryId || prod.category || null,
        prod.image || null,
        Number(prod.tax) || 0,
        Number(prod.discount) || 0,
        Number(prod.minStockLevel || prod.minStock) || 0,
        prod.supplierName || null,
        prod.recipeYield != null ? Number(prod.recipeYield) : null,
        prod.recipeUnit || null,
        rawMaterialsJson,
        prod.isBatchTracked ? 1 : 0
      ]);
      prodCount++;
    }
    console.log(`Migrated ${prodCount} products into MySQL.`);

    // 7. Migrate Sales
    console.log('\n--- 6. Migrating Sales & Bills ---');
    const mongoSales = await mongoDb.collection('sales').find().toArray();
    console.log(`Found ${mongoSales.length} sales in MongoDB`);

    let saleCount = 0;
    const highestPerKey = new Map<string, number>();

    for (const sale of mongoSales) {
      const saleId = sale.id || sale._id.toString();
      const billNumber = sale.billNumber || sale.bill_number || saleId;
      const itemsJson = JSON.stringify(sale.items || []);
      const createdAt = sale.timestamp
        ? new Date(sale.timestamp)
        : sale.createdAt
        ? new Date(sale.createdAt)
        : new Date();

      await mysqlConn.query(`
        INSERT INTO sales (
          id, company_id, bill_number, items, subtotal, discount, tax,
          round_off, total, payment_method, payment_status, customer_name,
          customer_phone, table_id, table_name, waiter_id, waiter_name,
          serving_status, order_type, order_source, online_order_id,
          order_note, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          bill_number = VALUES(bill_number),
          items = VALUES(items),
          subtotal = VALUES(subtotal),
          discount = VALUES(discount),
          tax = VALUES(tax),
          round_off = VALUES(round_off),
          total = VALUES(total),
          payment_method = VALUES(payment_method),
          payment_status = VALUES(payment_status),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          table_id = VALUES(table_id),
          table_name = VALUES(table_name),
          waiter_id = VALUES(waiter_id),
          waiter_name = VALUES(waiter_name),
          serving_status = VALUES(serving_status),
          order_type = VALUES(order_type),
          order_source = VALUES(order_source),
          online_order_id = VALUES(online_order_id),
          order_note = VALUES(order_note),
          created_by = VALUES(created_by),
          created_at = VALUES(created_at)
      `, [
        saleId,
        TARGET_COMPANY_ID,
        billNumber,
        itemsJson,
        Number(sale.subtotal) || 0,
        Number(sale.discount) || 0,
        Number(sale.tax) || 0,
        Number(sale.roundOff || sale.round_off) || 0,
        Number(sale.total) || 0,
        sale.paymentMethod || 'Cash',
        sale.paymentStatus || (sale.paymentMethod === 'Bill Only' ? 'unpaid' : 'paid'),
        sale.customerName || null,
        sale.customerPhone || null,
        sale.tableId || null,
        sale.tableName || null,
        sale.waiterId || null,
        sale.waiterName || null,
        sale.servingStatus || (sale.orderType === 'Dine In' ? 'Served' : 'Completed'),
        sale.orderType || 'Dine In',
        sale.orderSource || 'pos',
        sale.onlineOrderId || null,
        sale.orderNote || null,
        sale.createdBy || 'Cashier',
        createdAt
      ]);
      saleCount++;

      // Track sequences for bill numbering
      const parts = (billNumber || '').split('-');
      if (parts.length >= 3 && parts[0] === 'BILL') {
        const datePrefix = parts[1];
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq)) {
          const current = highestPerKey.get(datePrefix) || 0;
          if (seq > current) {
            highestPerKey.set(datePrefix, seq);
          }
        }
      }
    }
    console.log(`Migrated ${saleCount} sales into MySQL.`);

    // Prepopulate bill_sequences
    console.log('\n--- 7. Updating Bill Sequences ---');
    for (const [datePrefix, maxSeq] of highestPerKey.entries()) {
      await mysqlConn.query(`
        INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq))
      `, [TARGET_COMPANY_ID, datePrefix, maxSeq]);
    }
    console.log(`Updated ${highestPerKey.size} bill sequences.`);

    // 8. Migrate Cash Register
    console.log('\n--- 8. Migrating Cash Register ---');
    const mongoCash = await mongoDb.collection('cash_register').find().toArray();
    console.log(`Found ${mongoCash.length} cash register entries in MongoDB`);

    let cashCount = 0;
    for (const entry of mongoCash) {
      const entryId = entry.id || entry._id.toString();
      const createdAt = entry.timestamp
        ? new Date(entry.timestamp)
        : entry.createdAt
        ? new Date(entry.createdAt)
        : new Date();

      await mysqlConn.query(`
        INSERT INTO cash_register (
          id, company_id, sale_id, bill_number, type, amount,
          amount_received, change_given, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          sale_id = VALUES(sale_id),
          bill_number = VALUES(bill_number),
          type = VALUES(type),
          amount = VALUES(amount),
          amount_received = VALUES(amount_received),
          change_given = VALUES(change_given),
          created_at = VALUES(created_at)
      `, [
        entryId,
        TARGET_COMPANY_ID,
        entry.saleId || null,
        entry.saleId || null,
        entry.type || 'sale',
        Number(entry.amount) || 0,
        entry.amountReceived != null ? Number(entry.amountReceived) : null,
        entry.changeGiven != null ? Number(entry.changeGiven) : null,
        createdAt
      ]);
      cashCount++;
    }
    console.log(`Migrated ${cashCount} cash register entries into MySQL.`);

    console.log('\n=== MIGRATION COMPLETE SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await mysqlConn.end();
    await mongoClient.close();
  }
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
