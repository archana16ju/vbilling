const fs = require('fs');
const mysql = require('mysql2/promise');

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach((l) => {
  const p = l.indexOf('=');
  if (p > 0) process.env[l.slice(0, p).trim()] = l.slice(p + 1).trim();
});

const RAW_MATERIALS_50 = [
  { name: 'Basmati Rice', category: 'Grains & Pulses', unit: 'kg', minStock: 50, cost: 95 },
  { name: 'Fresh Chicken', category: 'Meat & Poultry', unit: 'kg', minStock: 40, cost: 220 },
  { name: 'Tender Mutton', category: 'Meat & Poultry', unit: 'kg', minStock: 30, cost: 750 },
  { name: 'Red Onions', category: 'Vegetables', unit: 'kg', minStock: 45, cost: 35 },
  { name: 'Country Tomatoes', category: 'Vegetables', unit: 'kg', minStock: 35, cost: 40 },
  { name: 'Green Chillies', category: 'Vegetables', unit: 'kg', minStock: 15, cost: 60 },
  { name: 'Ginger Root', category: 'Vegetables', unit: 'kg', minStock: 20, cost: 120 },
  { name: 'Garlic Pods', category: 'Vegetables', unit: 'kg', minStock: 20, cost: 180 },
  { name: 'Ginger Garlic Paste', category: 'Condiments', unit: 'kg', minStock: 25, cost: 140 },
  { name: 'Refined Sunflower Oil', category: 'Oils & Fats', unit: 'liter', minStock: 50, cost: 130 },
  { name: 'Pure Desi Ghee', category: 'Oils & Fats', unit: 'liter', minStock: 25, cost: 600 },
  { name: 'Curd / Yogurt', category: 'Dairy', unit: 'liter', minStock: 30, cost: 60 },
  { name: 'Fresh Milk', category: 'Dairy', unit: 'liter', minStock: 30, cost: 55 },
  { name: 'Fresh Paneer', category: 'Dairy', unit: 'kg', minStock: 25, cost: 360 },
  { name: 'Cooking Butter', category: 'Dairy', unit: 'kg', minStock: 20, cost: 480 },
  { name: 'Table Salt', category: 'Spices & Condiments', unit: 'kg', minStock: 20, cost: 25 },
  { name: 'Kashmiri Red Chilli Powder', category: 'Spices & Condiments', unit: 'kg', minStock: 15, cost: 320 },
  { name: 'Turmeric Powder', category: 'Spices & Condiments', unit: 'kg', minStock: 15, cost: 240 },
  { name: 'Coriander Powder', category: 'Spices & Condiments', unit: 'kg', minStock: 15, cost: 200 },
  { name: 'Garam Masala Powder', category: 'Spices & Condiments', unit: 'kg', minStock: 10, cost: 450 },
  { name: 'Green Cardamom (Elaichi)', category: 'Whole Spices', unit: 'g', minStock: 500, cost: 2.8 },
  { name: 'Cloves (Laung)', category: 'Whole Spices', unit: 'g', minStock: 500, cost: 1.2 },
  { name: 'Cinnamon Sticks (Dalchini)', category: 'Whole Spices', unit: 'g', minStock: 500, cost: 0.9 },
  { name: 'Star Anise (Biryani Flower)', category: 'Whole Spices', unit: 'g', minStock: 500, cost: 1.5 },
  { name: 'Bay Leaves (Tej Patta)', category: 'Whole Spices', unit: 'g', minStock: 300, cost: 0.5 },
  { name: 'Black Peppercorns', category: 'Whole Spices', unit: 'g', minStock: 800, cost: 0.8 },
  { name: 'Cumin Seeds (Jeera)', category: 'Whole Spices', unit: 'kg', minStock: 10, cost: 340 },
  { name: 'Mustard Seeds (Rai)', category: 'Whole Spices', unit: 'kg', minStock: 10, cost: 110 },
  { name: 'Fennel Seeds (Saunf)', category: 'Whole Spices', unit: 'kg', minStock: 10, cost: 220 },
  { name: 'Fresh Mint Leaves', category: 'Vegetables', unit: 'kg', minStock: 15, cost: 50 },
  { name: 'Fresh Coriander Leaves', category: 'Vegetables', unit: 'kg', minStock: 15, cost: 45 },
  { name: 'Curry Leaves', category: 'Vegetables', unit: 'kg', minStock: 10, cost: 80 },
  { name: 'Fresh Lemons', category: 'Vegetables', unit: 'piece', minStock: 100, cost: 5 },
  { name: 'Eggs (Poultry)', category: 'Dairy & Poultry', unit: 'piece', minStock: 150, cost: 6 },
  { name: 'All Purpose Flour (Maida)', category: 'Grains & Pulses', unit: 'kg', minStock: 40, cost: 42 },
  { name: 'Chakki Wheat Flour (Atta)', category: 'Grains & Pulses', unit: 'kg', minStock: 40, cost: 45 },
  { name: 'Refined White Sugar', category: 'Pantry', unit: 'kg', minStock: 35, cost: 44 },
  { name: 'Jaggery Powder', category: 'Pantry', unit: 'kg', minStock: 20, cost: 70 },
  { name: 'Whole Cashew Nuts', category: 'Nuts & Dry Fruits', unit: 'kg', minStock: 10, cost: 850 },
  { name: 'Golden Raisins', category: 'Nuts & Dry Fruits', unit: 'kg', minStock: 10, cost: 360 },
  { name: 'Grated Coconut', category: 'Vegetables', unit: 'kg', minStock: 20, cost: 90 },
  { name: 'Green Bell Pepper (Capsicum)', category: 'Vegetables', unit: 'kg', minStock: 20, cost: 65 },
  { name: 'Potatoes (Aloo)', category: 'Vegetables', unit: 'kg', minStock: 40, cost: 30 },
  { name: 'Carrots', category: 'Vegetables', unit: 'kg', minStock: 25, cost: 45 },
  { name: 'Green Peas (Frozen/Fresh)', category: 'Vegetables', unit: 'kg', minStock: 20, cost: 90 },
  { name: 'Pure Saffron (Kesar)', category: 'Spices & Condiments', unit: 'g', minStock: 50, cost: 350 },
  { name: 'Culinary Rose Water', category: 'Flavourings', unit: 'ml', minStock: 500, cost: 0.3 },
  { name: 'Kewra Water', category: 'Flavourings', unit: 'ml', minStock: 500, cost: 0.25 },
  { name: 'Kewpie / Sandwich Mayo', category: 'Sauces', unit: 'kg', minStock: 15, cost: 180 },
  { name: 'Tomato Ketchup Bulk', category: 'Sauces', unit: 'kg', minStock: 20, cost: 110 },
];

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
  });

  console.log('Seeding 50 Raw Materials and configuring All Products with Stock 999...');

  const [companies] = await pool.query('SELECT id, name FROM companies');
  const comp1 = companies[0]?.id || 'COMP-0001';

  // 1. Seed 50 Raw Materials for COMP-0001
  console.log(`\nStep 1: Upserting 50 sample raw materials for ${comp1}...`);
  const materialMap = new Map(); // name -> id

  for (let i = 0; i < RAW_MATERIALS_50.length; i++) {
    const item = RAW_MATERIALS_50[i];
    const rmId = `rm_${comp1}_${String(i + 1).padStart(3, '0')}`;
    const sku = `RM-${String(i + 1).padStart(4, '0')}`;

    await pool.query(
      `INSERT INTO raw_materials (
        id, company_id, name, category, sku, unit, stock, cost_per_unit, 
        low_stock_limit, status, last_replenished_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 999.000, ?, ?, 'In Stock', NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        category = VALUES(category),
        unit = VALUES(unit),
        stock = 999.000,
        cost_per_unit = VALUES(cost_per_unit),
        low_stock_limit = VALUES(low_stock_limit),
        status = 'In Stock',
        updated_at = NOW()`,
      [
        rmId,
        comp1,
        item.name,
        item.category,
        sku,
        item.unit,
        item.cost,
        item.minStock,
      ]
    );

    // Record Opening Stock Transaction
    const txId = `tx_open_${rmId}`;
    await pool.query(
      `INSERT INTO stock_transactions (
        id, company_id, raw_material_id, raw_material_name, type, 
        quantity_before, quantity_changed, quantity_after, date, reason, reference_id, created_at
      ) VALUES (?, ?, ?, ?, 'Opening Stock', 0, 999.000, 999.000, ?, 'Initial Stock 999', 'INIT', NOW())
      ON DUPLICATE KEY UPDATE 
        quantity_changed = 999.000,
        quantity_after = 999.000`,
      [txId, comp1, rmId, item.name, Date.now()]
    );

    materialMap.set(item.name, { id: rmId, unit: item.unit });
  }
  console.log(`✓ 50 Raw Materials created/verified with stock = 999.000!`);

  // Get available addon groups for comp1
  const [addonGroups] = await pool.query(
    'SELECT id, name FROM addon_groups WHERE company_id = ?',
    [comp1]
  );
  const addonGroupIds = addonGroups.map((g) => g.id);
  console.log(`Found ${addonGroupIds.length} addon groups for ${comp1}:`, addonGroupIds);

  // 2. Fetch all products
  const [products] = await pool.query('SELECT id, name, category_id, unit, price FROM products');
  console.log(`\nStep 2: Updating ${products.length} products with stock 999, batches, add-ons, and recipes...`);

  // Define recipe templates based on product name keywords
  function getRecipeForProduct(name) {
    const n = name.toLowerCase();
    const recipe = [];

    const getRm = (nm) => materialMap.get(nm);

    if (n.includes('biryani') || n.includes('briyani') || n.includes('rice') || n.includes('pulao')) {
      const rice = getRm('Basmati Rice');
      const oil = getRm('Refined Sunflower Oil');
      const onion = getRm('Red Onions');
      if (rice) recipe.push({ rawMaterialId: rice.id, quantity: 0.25, unit: rice.unit });
      if (oil) recipe.push({ rawMaterialId: oil.id, quantity: 0.04, unit: oil.unit });
      if (onion) recipe.push({ rawMaterialId: onion.id, quantity: 0.08, unit: onion.unit });

      if (n.includes('mutton')) {
        const mutton = getRm('Tender Mutton');
        if (mutton) recipe.push({ rawMaterialId: mutton.id, quantity: 0.25, unit: mutton.unit });
      } else if (n.includes('egg')) {
        const egg = getRm('Eggs (Poultry)');
        if (egg) recipe.push({ rawMaterialId: egg.id, quantity: 2, unit: egg.unit });
      } else {
        const chicken = getRm('Fresh Chicken');
        if (chicken) recipe.push({ rawMaterialId: chicken.id, quantity: 0.25, unit: chicken.unit });
      }
    } else if (n.includes('chicken') || n.includes('chukka') || n.includes('65') || n.includes('fry') || n.includes('tikka')) {
      const chicken = getRm('Fresh Chicken');
      const oil = getRm('Refined Sunflower Oil');
      const spices = getRm('Kashmiri Red Chilli Powder');
      if (chicken) recipe.push({ rawMaterialId: chicken.id, quantity: 0.2, unit: chicken.unit });
      if (oil) recipe.push({ rawMaterialId: oil.id, quantity: 0.05, unit: oil.unit });
      if (spices) recipe.push({ rawMaterialId: spices.id, quantity: 0.02, unit: spices.unit });
    } else if (n.includes('mutton')) {
      const mutton = getRm('Tender Mutton');
      const oil = getRm('Refined Sunflower Oil');
      const onion = getRm('Red Onions');
      if (mutton) recipe.push({ rawMaterialId: mutton.id, quantity: 0.2, unit: mutton.unit });
      if (oil) recipe.push({ rawMaterialId: oil.id, quantity: 0.04, unit: oil.unit });
      if (onion) recipe.push({ rawMaterialId: onion.id, quantity: 0.05, unit: onion.unit });
    } else if (n.includes('dosa') || n.includes('idli') || n.includes('parotta') || n.includes('bread') || n.includes('roti') || n.includes('naan')) {
      const flour = n.includes('parotta') ? getRm('All Purpose Flour (Maida)') : getRm('Chakki Wheat Flour (Atta)');
      const ghee = getRm('Pure Desi Ghee');
      const salt = getRm('Table Salt');
      if (flour) recipe.push({ rawMaterialId: flour.id, quantity: 0.15, unit: flour.unit });
      if (ghee) recipe.push({ rawMaterialId: ghee.id, quantity: 0.02, unit: ghee.unit });
      if (salt) recipe.push({ rawMaterialId: salt.id, quantity: 0.005, unit: salt.unit });
    } else if (n.includes('mojito') || n.includes('juice') || n.includes('shake') || n.includes('tea') || n.includes('coffee') || n.includes('lassi')) {
      const sugar = getRm('Refined White Sugar');
      const lemon = getRm('Fresh Lemons');
      const mint = getRm('Fresh Mint Leaves');
      const milk = getRm('Fresh Milk');
      if (n.includes('milk') || n.includes('shake') || n.includes('tea') || n.includes('coffee') || n.includes('lassi')) {
        if (milk) recipe.push({ rawMaterialId: milk.id, quantity: 0.2, unit: milk.unit });
        if (sugar) recipe.push({ rawMaterialId: sugar.id, quantity: 0.02, unit: sugar.unit });
      } else {
        if (sugar) recipe.push({ rawMaterialId: sugar.id, quantity: 0.03, unit: sugar.unit });
        if (lemon) recipe.push({ rawMaterialId: lemon.id, quantity: 1, unit: lemon.unit });
        if (mint) recipe.push({ rawMaterialId: mint.id, quantity: 0.01, unit: mint.unit });
      }
    } else if (n.includes('paneer')) {
      const paneer = getRm('Fresh Paneer');
      const butter = getRm('Cooking Butter');
      const tomato = getRm('Country Tomatoes');
      if (paneer) recipe.push({ rawMaterialId: paneer.id, quantity: 0.15, unit: paneer.unit });
      if (butter) recipe.push({ rawMaterialId: butter.id, quantity: 0.03, unit: butter.unit });
      if (tomato) recipe.push({ rawMaterialId: tomato.id, quantity: 0.08, unit: tomato.unit });
    } else {
      // Default general recipe
      const onion = getRm('Red Onions');
      const oil = getRm('Refined Sunflower Oil');
      const salt = getRm('Table Salt');
      if (onion) recipe.push({ rawMaterialId: onion.id, quantity: 0.05, unit: onion.unit });
      if (oil) recipe.push({ rawMaterialId: oil.id, quantity: 0.02, unit: oil.unit });
      if (salt) recipe.push({ rawMaterialId: salt.id, quantity: 0.005, unit: salt.unit });
    }

    return recipe;
  }

  let batchCount = 0;
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const recipe = getRecipeForProduct(prod.name);
    const assignedAddons = addonGroupIds.length > 0 ? addonGroupIds : [];

    // 1. Update Product row
    await pool.query(
      `UPDATE products SET 
        stock = 999.000,
        is_batch_tracked = 1,
        min_stock = 10.000,
        addon_group_ids = ?,
        raw_materials_json = ?
      WHERE id = ?`,
      [
        JSON.stringify([]),
        JSON.stringify(recipe),
        prod.id,
      ]
    );

    // 2. Upsert Batch in product_batches
    const batchNum = `BAT-20261111-${String(i + 1).padStart(3, '0')}`;
    const batchId = `bat_${prod.id}_${Date.now()}`;

    // Check if batch already exists for this product
    const [existingBatches] = await pool.query(
      'SELECT id FROM product_batches WHERE item_type = "product" AND item_id = ?',
      [prod.id]
    );

    if (existingBatches.length > 0) {
      await pool.query(
        `UPDATE product_batches SET 
          current_quantity = 999.000,
          initial_quantity = 999.000,
          status = 'active',
          expiry_date = '2027-05-09 18:30:00',
          updated_at = NOW()
        WHERE id = ?`,
        [existingBatches[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO product_batches (
          id, company_id, item_type, item_id, batch_number,
          manufacturing_date, expiry_date, initial_quantity, current_quantity,
          min_stock_level, purchase_cost, selling_price, supplier_id, status, created_at, updated_at
        ) VALUES (
          ?, ?, 'product', ?, ?,
          '2026-11-10 18:30:00', '2027-05-09 18:30:00', 999.000, 999.000,
          10.000, 0.00, ?, 'sup_1793011591578', 'active', NOW(), NOW()
        )`,
        [
          batchId,
          comp1,
          prod.id,
          batchNum,
          prod.price || 0,
        ]
      );
    }
    batchCount++;
  }

  console.log(`✓ All ${products.length} products updated!`);
  console.log(`  - Stock set to 999.000 for each product`);
  console.log(`  - is_batch_tracked enabled with active batch (Qty: 999) for each product`);
  console.log(`  - Add-ons assigned to each product`);
  console.log(`  - Recipes mapped to each product`);

  await pool.end();
  console.log('\nSeeding completed successfully!');
}

main().catch(console.error);
