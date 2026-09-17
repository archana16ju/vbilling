'use server';

import clientPromise from '@/lib/mongodb';
import { Product, Category } from '@/lib/mock-data';

export async function getDb() {
  const client = await clientPromise;
  return client.db('billing_software');
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const products = await db.collection('products').find({}).toArray();
  // Map _id to id if necessary, but we can just use string id we generate
  return products.map(p => ({
    ...p,
    _id: p._id.toString(),
  })) as unknown as Product[];
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const db = await getDb();
  const newProduct = { ...product, id: "p" + Date.now() }; // Generate simple string ID
  await db.collection('products').insertOne(newProduct as any);
  return newProduct as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection('products').updateOne({ id }, { $set: updates });
  return result.modifiedCount > 0 || result.matchedCount > 0;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection('products').deleteOne({ id });
  return result.deletedCount > 0;
}

// --- CATEGORIES ---
export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const categories = await db.collection('categories').find({}).toArray();
  return categories.map(c => ({
    ...c,
    _id: c._id.toString(),
  })) as unknown as Category[];
}

export async function createCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const db = await getDb();
  const newCategory = { ...category, id: "c" + Date.now() };
  await db.collection('categories').insertOne(newCategory as any);
  return newCategory as Category;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection('categories').updateOne({ id }, { $set: updates });
  return result.modifiedCount > 0 || result.matchedCount > 0;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection('categories').deleteOne({ id });
  return result.deletedCount > 0;
}

import { PRODUCTS, CATEGORIES } from '@/lib/mock-data';

export async function seedDatabase() {
  const db = await getDb();
  const prodCount = await db.collection('products').countDocuments();
  if (prodCount === 0) {
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, _id: p.id as any })));
  }
  const catCount = await db.collection('categories').countDocuments();
  if (catCount === 0) {
    await db.collection('categories').insertMany(CATEGORIES.map(c => ({ ...c, _id: c.id as any })));
  }
}

export async function getNextBillId(): Promise<string> {
  const db = await getDb();
  const now = new Date();
  // Format: DDMMYY
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;

  // Count how many bills exist today
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const todayCount = await db.collection('sales').countDocuments({
    timestamp: { $gte: startOfDay.getTime(), $lte: endOfDay.getTime() }
  });

  const seq = String(todayCount + 1).padStart(3, '0');
  return `${datePrefix}-${seq}`; // e.g. 170926-001
}

export async function recordSale(sale: any) {
  const db = await getDb();
  // Insert sale
  await db.collection('sales').insertOne({ ...sale, _id: sale.id as any });
  
  // Update stock for each product
  for (const item of sale.items) {
    await db.collection('products').updateOne(
      { id: item.product.id },
      { $inc: { stock: -item.quantity } }
    );
  }
  return true;
}
