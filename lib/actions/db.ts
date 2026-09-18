'use server';

import clientPromise from '@/lib/mongodb';
import { Product, Category, PRODUCTS, CATEGORIES } from '@/lib/mock-data';

export async function getDb() {
  const client = await clientPromise;
  if (!client) throw new Error('MongoDB is offline/disconnected');
  return client.db('billing_software');
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  try {
    const db = await getDb();
    const products = await db.collection('products').find({}).toArray();
    if (!products || products.length === 0) return PRODUCTS;
    return products.map(p => ({
      ...p,
      _id: p._id ? p._id.toString() : p.id,
    })) as unknown as Product[];
  } catch (err) {
    console.error('getProducts DB error:', err);
    return PRODUCTS;
  }
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const newProduct = { ...product, id: "p" + Date.now() };
  try {
    const db = await getDb();
    await db.collection('products').insertOne(newProduct as any);
  } catch (err) {
    console.error('createProduct DB error:', err);
  }
  return newProduct as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('products').updateOne({ id }, { $set: updates });
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (err) {
    console.error('updateProduct DB error:', err);
    return false;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('products').deleteOne({ id });
    return result.deletedCount > 0;
  } catch (err) {
    console.error('deleteProduct DB error:', err);
    return false;
  }
}

// --- CATEGORIES ---
export async function getCategories(): Promise<Category[]> {
  try {
    const db = await getDb();
    const categories = await db.collection('categories').find({}).toArray();
    if (!categories || categories.length === 0) return CATEGORIES;
    return categories.map(c => ({
      ...c,
      _id: c._id ? c._id.toString() : c.id,
    })) as unknown as Category[];
  } catch (err) {
    console.error('getCategories DB error:', err);
    return CATEGORIES;
  }
}

export async function createCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const newCategory = { ...category, id: "c" + Date.now() };
  try {
    const db = await getDb();
    await db.collection('categories').insertOne(newCategory as any);
  } catch (err) {
    console.error('createCategory DB error:', err);
  }
  return newCategory as Category;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('categories').updateOne({ id }, { $set: updates });
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (err) {
    console.error('updateCategory DB error:', err);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('categories').deleteOne({ id });
    return result.deletedCount > 0;
  } catch (err) {
    console.error('deleteCategory DB error:', err);
    return false;
  }
}

export async function seedDatabase() {
  try {
    const db = await getDb();
    const prodCount = await db.collection('products').countDocuments();
    if (prodCount === 0) {
      await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, _id: p.id as any })));
    }
    const catCount = await db.collection('categories').countDocuments();
    if (catCount === 0) {
      await db.collection('categories').insertMany(CATEGORIES.map(c => ({ ...c, _id: c.id as any })));
    }
  } catch (err) {
    console.error('seedDatabase error:', err);
  }
}

export async function getNextBillId(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;

  try {
    const db = await getDb();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const todayCount = await db.collection('sales').countDocuments({
      timestamp: { $gte: startOfDay.getTime(), $lte: endOfDay.getTime() }
    });

    const seq = String(todayCount + 1).padStart(3, '0');
    return `${datePrefix}-${seq}`;
  } catch (err) {
    console.error('getNextBillId error:', err);
    return `${datePrefix}-${String(Math.floor(Math.random() * 900) + 100)}`;
  }
}

export async function recordSale(sale: any) {
  try {
    const db = await getDb();
    await db.collection('sales').insertOne({ ...sale, _id: sale.id as any });
    for (const item of sale.items) {
      await db.collection('products').updateOne(
        { id: item.product.id },
        { $inc: { stock: -item.quantity } }
      );
    }
    return true;
  } catch (err) {
    console.error('recordSale error:', err);
    return false;
  }
}

export async function clearAllSales() {
  try {
    const db = await getDb();
    await db.collection('sales').deleteMany({});
    return true;
  } catch (err) {
    console.error('clearAllSales error:', err);
    return false;
  }
}
