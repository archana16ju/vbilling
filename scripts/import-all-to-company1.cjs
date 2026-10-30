const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('--- Starting Products & Categories Import to COMP-0001 ---');

  // 1. Connect to MySQL
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'local_billing_db'
  });

  // Verify company exists
  const [companies] = await conn.query('SELECT id, name FROM companies WHERE id = ?', ['COMP-0001']);
  if (!companies || companies.length === 0) {
    throw new Error("Company COMP-0001 not found in MySQL!");
  }
  console.log(`Target Company found: ${companies[0].id} (${companies[0].name})`);

  // 2. Read seed-remote.js
  const seedContent = fs.readFileSync('seed-remote.js', 'utf8');
  const catMatch = seedContent.match(/const CATEGORIES = (\[[\s\S]*?\]);/);
  const prodMatch = seedContent.match(/const PRODUCTS = (\[[\s\S]*?\]);/);
  const seedCats = eval(catMatch[1]);
  const seedProds = eval(prodMatch[1]);
  const seedProdMap = new Map(seedProds.map(p => [p.id, p]));

  // 3. Read SQLite
  const dbPath = path.join('C:/Users/ADMIN/.billing-software/BillingOfflineStorage/database', 'local_storage.db');
  const sqliteDb = new Database(dbPath);
  const sqliteCats = sqliteDb.prepare('SELECT * FROM local_categories').all();
  const sqliteProds = sqliteDb.prepare('SELECT * FROM local_products').all();
  const sqliteCatMap = new Map(sqliteCats.map(c => [c.id, c]));

  // 4. Categories to insert (c1 to c11)
  const targetCatIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
  const categoriesToInsert = targetCatIds.map(id => {
    const sqliteCat = sqliteCatMap.get(id);
    const seedCat = seedCats.find(c => c.id === id);
    return {
      id,
      company_id: 'COMP-0001',
      name: sqliteCat ? sqliteCat.name : seedCat.name,
      image: sqliteCat ? sqliteCat.image : null
    };
  });

  // 5. Products to insert
  const productsToInsert = sqliteProds
    .filter(p => targetCatIds.includes(p.category))
    .map(p => {
      const seed = seedProdMap.get(p.id) || {};
      let rawMaterialsJson = null;
      if (p.rawMaterials) {
        try {
          const parsed = typeof p.rawMaterials === 'string' ? JSON.parse(p.rawMaterials) : p.rawMaterials;
          rawMaterialsJson = JSON.stringify(parsed);
        } catch {
          rawMaterialsJson = null;
        }
      }

      return {
        id: p.id,
        company_id: 'COMP-0001',
        name: p.name,
        sku: seed.sku || ('SKU-' + p.id),
        barcode: seed.barcode || ('' + Math.floor(100000000000 + Math.random() * 900000000000)),
        price: Number(p.price ?? seed.price ?? 0),
        stock: Number(p.stock ?? seed.stock ?? 999),
        unit: seed.unit || 'plate',
        quantity_step: Number(p.quantityStep ?? seed.quantityStep ?? 1),
        category_id: p.category,
        image: p.image || null,
        tax: 5.0,
        discount: 0.0,
        recipe_yield: p.recipeYield ? Number(p.recipeYield) : null,
        recipe_unit: p.recipeUnit || null,
        raw_materials_json: rawMaterialsJson
      };
    });

  console.log(`Found ${categoriesToInsert.length} categories and ${productsToInsert.length} products to insert.`);

  await conn.beginTransaction();
  try {
    // A. Insert Categories
    console.log('Inserting categories into MySQL...');
    for (const cat of categoriesToInsert) {
      await conn.query(
        `INSERT INTO categories (id, company_id, name, image)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           company_id = VALUES(company_id),
           name = VALUES(name),
           image = VALUES(image)`,
        [cat.id, cat.company_id, cat.name, cat.image]
      );
    }
    console.log(`Successfully upserted ${categoriesToInsert.length} categories.`);

    // B. Insert Products
    console.log('Inserting products into MySQL...');
    for (const prod of productsToInsert) {
      await conn.query(
        `INSERT INTO products (
           id, company_id, name, sku, barcode, price, stock, unit,
           quantity_step, category_id, image, tax, discount,
           recipe_yield, recipe_unit, raw_materials_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           recipe_yield = VALUES(recipe_yield),
           recipe_unit = VALUES(recipe_unit),
           raw_materials_json = VALUES(raw_materials_json)`,
        [
          prod.id,
          prod.company_id,
          prod.name,
          prod.sku,
          prod.barcode,
          prod.price,
          prod.stock,
          prod.unit,
          prod.quantity_step,
          prod.category_id,
          prod.image,
          prod.tax,
          prod.discount,
          prod.recipe_yield,
          prod.recipe_unit,
          prod.raw_materials_json
        ]
      );
    }
    console.log(`Successfully upserted ${productsToInsert.length} products.`);

    // C. Re-point existing test products to official categories (c1 & c8)
    await conn.query(`UPDATE products SET category_id = 'c1' WHERE id = 'p1792482218277' AND company_id = 'COMP-0001'`);
    await conn.query(`UPDATE products SET category_id = 'c8' WHERE id = 'p1792482301886' AND company_id = 'COMP-0001'`);

    // D. Clean up temporary duplicate categories
    await conn.query(`DELETE FROM categories WHERE id IN ('c1792482113140', 'c1792482246189') AND company_id = 'COMP-0001'`);

    await conn.commit();
    console.log('MySQL Transaction committed successfully!');

    // E. Sync SQLite local_storage.db company_id so offline cache matches
    try {
      console.log('Updating SQLite offline storage company_id...');
      const updateCat = sqliteDb.prepare(`UPDATE local_categories SET company_id = 'COMP-0001' WHERE id IN (${targetCatIds.map(() => '?').join(',')})`);
      updateCat.run(...targetCatIds);

      const updateProd = sqliteDb.prepare(`UPDATE local_products SET company_id = 'COMP-0001' WHERE category IN (${targetCatIds.map(() => '?').join(',')})`);
      updateProd.run(...targetCatIds);
      console.log('SQLite offline storage successfully updated.');
    } catch (sqliteErr) {
      console.warn('Note on SQLite sync:', sqliteErr.message);
    }

  } catch (err) {
    await conn.rollback();
    console.error('Failed to import, rolled back MySQL:', err);
    throw err;
  } finally {
    // Verify results
    const [finalCats] = await conn.query('SELECT count(*) as count FROM categories WHERE company_id = ?', ['COMP-0001']);
    const [finalProds] = await conn.query('SELECT count(*) as count FROM products WHERE company_id = ?', ['COMP-0001']);
    console.log(`\nFinal COMP-0001 verification:`);
    console.log(`- Categories in COMP-0001: ${finalCats[0].count}`);
    console.log(`- Products in COMP-0001: ${finalProds[0].count}`);

    const [comp2Prods] = await conn.query('SELECT count(*) as count FROM products WHERE company_id = ?', ['COMP-0002']);
    console.log(`- Products in COMP-0002 (unaffected): ${comp2Prods[0].count}`);

    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
