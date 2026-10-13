'use server';

import clientPromise from '@/lib/mongodb';
import { Product, Category, PRODUCTS, CATEGORIES } from '@/lib/mock-data';
import { getLocalProducts, getLocalCategories, addDashboardSyncAction, cacheDashboardData } from '@/lib/storage';
import { calculateRecipeDeduction, getRawMaterials, processStockTransactions } from '@/lib/actions/inventory';

export async function getDb() {
  const client = await clientPromise;
  if (!client) throw new Error('MongoDB is offline/disconnected');
  return client.db();
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  try {
    const db = await getDb();
    const products = await db.collection('products').find({}).toArray();
    
    // Save fresh online data straight into SQLite without putting it in the sync queue!
    await cacheDashboardData('PRODUCT', products);

    if (!products || products.length === 0) return PRODUCTS;
    const mapped = products.map(p => ({
      ...p,
      _id: p._id ? p._id.toString() : p.id,
    })) as unknown as Product[];
    
    // Sort products by name
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('getProducts DB error (falling back to local):', err);
    const local = await getLocalProducts();
    if (local && local.length > 0) return local as unknown as Product[];
    return PRODUCTS;
  }
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const newProduct = { ...product, id: "p" + Date.now() };
  try {
    const db = await getDb();
    const result = await db.collection('products').insertOne({ ...newProduct } as any);
    // Always sync the successful change to local SQLite cache
    const { cacheDashboardData } = await import('@/lib/storage');
    await cacheDashboardData('PRODUCT', [newProduct]);
  } catch (err) {
    console.error('createProduct DB error (falling back to offline queue):', err);
    const { cacheDashboardData, addDashboardSyncAction } = await import('@/lib/storage');
    await cacheDashboardData('PRODUCT', [newProduct]);
    await addDashboardSyncAction('CREATE', 'PRODUCT', newProduct.id, newProduct);
  }
  return newProduct as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('products').updateOne({ id }, { $set: updates });
    // Always sync the successful change to local SQLite cache
    const { getLocalProducts, cacheDashboardData } = await import('@/lib/storage');
    const existingProducts = await getLocalProducts();
    const existingProduct = existingProducts.find((p: any) => p.id === id);
    if (existingProduct) {
      await cacheDashboardData('PRODUCT', [{ ...existingProduct, ...updates }]);
    }
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (err) {
    console.error('updateProduct DB error (falling back to offline queue):', err);
    const { addDashboardSyncAction, getLocalProducts, cacheDashboardData } = await import('@/lib/storage');
    const existingProducts = await getLocalProducts();
    const existingProduct = existingProducts.find((p: any) => p.id === id);
    if (existingProduct) {
      await cacheDashboardData('PRODUCT', [{ ...existingProduct, ...updates }]);
    }
    await addDashboardSyncAction('UPDATE', 'PRODUCT', id, updates);
    return true;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('products').deleteOne({ id });
    // Always sync the successful deletion to local SQLite cache
    const { removeLocalDashboardData } = await import('@/lib/storage');
    await removeLocalDashboardData('PRODUCT', id);
    return result.deletedCount > 0;
  } catch (err) {
    console.error('deleteProduct DB error (falling back to offline queue):', err);
    const { addDashboardSyncAction, removeLocalDashboardData } = await import('@/lib/storage');
    await removeLocalDashboardData('PRODUCT', id);
    await addDashboardSyncAction('DELETE', 'PRODUCT', id, {});
    return true;
  }
}

// --- CATEGORIES ---
export async function getCategories(): Promise<Category[]> {
  try {
    const db = await getDb();
    const categories = await db.collection('categories').find({}).toArray();
    
    // Save fresh online data straight into SQLite without putting it in the sync queue!
    await cacheDashboardData('CATEGORY', categories);

    if (!categories || categories.length === 0) return CATEGORIES;
    const mapped = categories
      .filter(c => !c.id.startsWith('rm')) // Prevent Raw Materials from leaking into categories
      .map(c => ({
        ...c,
        _id: c._id ? c._id.toString() : c.id,
      })) as unknown as Category[];
      
    // Sort categories alphabetically
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('getCategories DB error (falling back to local):', err);
    const local = await getLocalCategories();
    if (local && local.length > 0) return local as unknown as Category[];
    return CATEGORIES;
  }
}

export async function createCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const newCategory = { ...category, id: "c" + Date.now() };
  try {
    const db = await getDb();
    await db.collection('categories').insertOne({ ...newCategory } as any);
    const { cacheDashboardData } = await import('@/lib/storage');
    await cacheDashboardData('CATEGORY', [newCategory]);
  } catch (err) {
    console.error('createCategory DB error (falling back to offline queue):', err);
    const { cacheDashboardData, addDashboardSyncAction } = await import('@/lib/storage');
    await cacheDashboardData('CATEGORY', [newCategory]);
    await addDashboardSyncAction('CREATE', 'CATEGORY', newCategory.id, newCategory);
  }
  return newCategory as Category;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('categories').updateOne({ id }, { $set: updates });
    const { getLocalCategories, cacheDashboardData } = await import('@/lib/storage');
    const existingCats = await getLocalCategories();
    const existingCat = existingCats.find((c: any) => c.id === id);
    if (existingCat) {
      await cacheDashboardData('CATEGORY', [{ ...existingCat, ...updates }]);
    }
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (err) {
    console.error('updateCategory DB error (falling back to offline queue):', err);
    const { addDashboardSyncAction, getLocalCategories, cacheDashboardData } = await import('@/lib/storage');
    const existingCats = await getLocalCategories();
    const existingCat = existingCats.find((c: any) => c.id === id);
    if (existingCat) {
      await cacheDashboardData('CATEGORY', [{ ...existingCat, ...updates }]);
    }
    await addDashboardSyncAction('UPDATE', 'CATEGORY', id, updates);
    return true;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.collection('categories').deleteOne({ id });
    const { removeLocalDashboardData } = await import('@/lib/storage');
    await removeLocalDashboardData('CATEGORY', id);
    return result.deletedCount > 0;
  } catch (err) {
    console.error('deleteCategory DB error (falling back to offline queue):', err);
    const { addDashboardSyncAction, removeLocalDashboardData } = await import('@/lib/storage');
    await removeLocalDashboardData('CATEGORY', id);
    await addDashboardSyncAction('DELETE', 'CATEGORY', id, {});
    return true;
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

export async function getNextBillId(): Promise<{ id: string, count: number }> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;

  try {
    const db = await getDb();
    
    // Find the latest bill for today to get the true max sequence (handles deleted bills safely)
    const latestSale = await db.collection('sales').find({ 
      id: { $regex: `^BILL-${datePrefix}-` }
    }).sort({ id: -1 }).limit(1).toArray();
    
    let todayCount = 0;
    if (latestSale.length > 0) {
      const parts = latestSale[0].id.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        todayCount = lastSeq;
      }
    }

    const seq = todayCount + 1;
    return { id: `BILL-${datePrefix}-${String(seq).padStart(3, '0')}`, count: todayCount };
  } catch (err) {
    console.error('getNextBillId error:', err);
    return { id: `BILL-${datePrefix}-${String(Math.floor(Math.random() * 900) + 100)}`, count: 0 };
  }
}

export async function recordSale(sale: any) {
  try {
    const db = await getDb();
    
    // Check for idempotency: if bill already exists, skip processing and return success
    if (sale.id) {
      const existingSale = await db.collection('sales').findOne({ $or: [{ id: sale.id }, { _id: sale.id }] });
      if (existingSale) {
        return { success: true, sale: { ...existingSale, _id: existingSale._id.toString() } };
      }
    }
    
    // Server-side validation and recalculation
    const productIds = sale.items.map((i: any) => i.product.id);
    const dbProducts = await db.collection('products').find({ id: { $in: productIds } }).toArray();

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedItemDiscounts = 0;
    
    const validatedItems = sale.items.map((item: any) => {
      const dbP = dbProducts.find(p => p.id === item.product.id);
      
      // If product is not in DB (e.g. client has stale data or it was deleted), use the client's product data as fallback
      const price = dbP ? (dbP.price || 0) : (item.product.price || 0);
      const discountRate = dbP ? (dbP.discount || 0) : (item.product.discount || 0);
      const taxRate = dbP ? (dbP.tax || 0) : (item.product.tax || 0);
      const qty = item.quantity;
      
      const itemSubtotal = price * qty;
      const itemDiscount = itemSubtotal * (discountRate / 100);
      const afterDiscount = itemSubtotal - itemDiscount;
      const itemTax = afterDiscount * (taxRate / 100);
      
      calculatedSubtotal += itemSubtotal;
      calculatedTax += itemTax;
      calculatedItemDiscounts += itemDiscount;
      
      return { 
        ...item, 
        product: { ...item.product, price, tax: taxRate, discount: discountRate } 
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

    const finalSale = {
      ...sale,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: calculatedItemDiscounts + globalDiscountAmount,
      tax: calculatedTax,
      cgst: calculatedCgst,
      sgst: calculatedSgst,
      roundOff: roundOff,
      total: finalTotal,
      _id: sale.id as any
    };

    await db.collection('sales').insertOne(finalSale);
    
    const allRawMaterials = await getRawMaterials();
    const stockTxs = [];

    for (const item of finalSale.items) {
      await db.collection('products').updateOne(
        { id: item.product.id },
        { $inc: { stock: -item.quantity } }
      );
      
      // Recipe Deduction
      const dbP = dbProducts.find(p => p.id === item.product.id);
      const productToUse = dbP || item.product;
      
      if (productToUse.rawMaterials && productToUse.rawMaterials.length > 0) {
        const deductions = await calculateRecipeDeduction(productToUse.rawMaterials, item.quantity, allRawMaterials);
        for (const d of deductions) {
          stockTxs.push({
            rawMaterialId: d.materialId,
            type: 'Stock Deduction',
            quantityBefore: 0, // Simplified for now, backend will handle $inc
            quantityChanged: -d.quantityToDeduct,
            quantityAfter: 0,
            reason: `Sale ${finalSale.id}`,
            referenceId: finalSale.id
          });
        }
      }
    }
    
    if (stockTxs.length > 0) {
      await processStockTransactions(stockTxs as any, true);
    }

    if (finalSale.paymentMethod === 'Cash') {
      await db.collection('cash_register').insertOne({
        id: 'cr-' + Date.now(),
        saleId: finalSale.id,
        type: 'sale',
        amount: finalSale.total,
        amountReceived: finalSale.amountReceived || finalSale.total,
        changeGiven: finalSale.changeAmount || 0,
        timestamp: Date.now()
      });
    }

    return { success: true, sale: finalSale };
  } catch (err: any) {
    if (err.code === 11000) {
      // Race condition caught by MongoDB unique _id index. 
      // Ensure it's actually the same sale before treating it as successful sync.
      try {
        const db = await getDb();
        const existingSale = await db.collection('sales').findOne({ _id: sale.id as any });
        if (existingSale && existingSale.total === sale.total) {
          return { success: true, sale: { ...existingSale, _id: existingSale._id.toString() } };
        }
      } catch(e) {}
      return { success: false, error: 'Bill ID collision: A different sale already exists with this ID.' };
    }
    console.error('recordSale error:', err);
    return { success: false, error: err.message };
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

export async function getLiveSales(): Promise<any[]> {
  try {
    const db = await getDb();
    const sales = await db.collection('sales').find().sort({ timestamp: -1 }).limit(200).toArray();
    return sales.map(s => ({ ...s, _id: s._id.toString(), syncStatus: 'COMPLETED' }));
  } catch (e) {
    console.error("Failed to fetch live sales", e);
    return [];
  }
}



