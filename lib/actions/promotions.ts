'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { getDb } from './db';
import { getSession } from '@/lib/auth-session';
import { Promotion, PromotionUsage, PromotionValidationResult, PromotionType, PromotionScope } from '@/types/promotions';
import {
  mysqlGetPromotions,
  mysqlCreatePromotion,
  mysqlUpdatePromotion,
  mysqlDeletePromotion,
  mysqlValidatePromotion,
  mysqlRecordPromotionUsage,
} from '@/lib/mysql-promotions';

async function getAuthCompanyId(): Promise<string> {
  const session = await getSession();
  if (!session || !session.companyId) {
    return 'comp_default';
  }
  return session.companyId;
}

export async function getPromotions(companyIdParam?: string): Promise<Promotion[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetPromotions(companyIdParam);
  }

  const db = await getDb();
  const companyId = companyIdParam || (await getAuthCompanyId());
  const rows = await db.collection('promotions')
    .find({ companyId })
    .sort({ isActive: -1, createdAt: -1 })
    .toArray();

  return rows.map((r: any) => ({
    id: r.id || r._id.toString(),
    companyId: r.companyId,
    code: r.code,
    title: r.title,
    description: r.description || null,
    promoType: r.promoType,
    discountValue: Number(r.discountValue) || 0,
    maxDiscountAmount: r.maxDiscountAmount != null ? Number(r.maxDiscountAmount) : null,
    minCartValue: Number(r.minCartValue) || 0,
    startDate: r.startDate,
    endDate: r.endDate,
    isHappyHour: Boolean(r.isHappyHour),
    happyHourStart: r.happyHourStart || null,
    happyHourEnd: r.happyHourEnd || null,
    applicableDays: r.applicableDays || null,
    applicableScope: r.applicableScope || 'entire_bill',
    scopeIds: r.scopeIds || null,
    bogoBuyProductId: r.bogoBuyProductId || null,
    bogoBuyQuantity: Number(r.bogoBuyQuantity) || 1,
    promotionalPrice: r.promotionalPrice != null ? Number(r.promotionalPrice) : null,
    bogoGetProductId: r.bogoGetProductId || null,
    bogoGetQuantity: Number(r.bogoGetQuantity) || 1,
    usageLimitTotal: r.usageLimitTotal != null ? Number(r.usageLimitTotal) : null,
    usageLimitPerCustomer: Number(r.usageLimitPerCustomer) || 1,
    totalUsedCount: Number(r.totalUsedCount) || 0,
    isActive: Boolean(r.isActive),
    createdAt: r.createdAt || Date.now(),
    updatedAt: r.updatedAt || Date.now(),
  }));
}

export async function createPromotion(data: Omit<Promotion, 'id' | 'companyId' | 'totalUsedCount' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
  if (isLocalMySqlMode()) {
    return await mysqlCreatePromotion(data);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const id = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const code = data.code.trim().toUpperCase();

  const newPromo: Promotion = {
    ...data,
    id,
    companyId,
    code,
    totalUsedCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.collection('promotions').insertOne(newPromo as any);
  return newPromo;
}

export async function updatePromotion(id: string, updates: Partial<Promotion>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdatePromotion(id, updates);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const result = await db.collection('promotions').updateOne(
    { id, companyId },
    { $set: { ...updates, updatedAt: Date.now() } }
  );

  return result.modifiedCount > 0;
}

export async function deletePromotion(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeletePromotion(id);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  await db.collection('promotion_usages').deleteMany({ promotionId: id, companyId });
  const result = await db.collection('promotions').deleteOne({ id, companyId });
  return result.deletedCount > 0;
}

export async function validatePromotion(
  code: string,
  cartItems: { productId: string; categoryId?: string; price: number; quantity: number }[],
  cartSubtotal: number,
  customerId?: string | null
): Promise<PromotionValidationResult> {
  if (isLocalMySqlMode()) {
    return await mysqlValidatePromotion(code, cartItems, cartSubtotal, customerId);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const promo = await db.collection('promotions').findOne({
    companyId,
    code: code.trim().toUpperCase(),
    isActive: true,
  });

  if (!promo) {
    return { isValid: false, discountAmount: 0, errorMessage: 'Invalid or inactive promo code.' };
  }

  const now = new Date();
  const nowStr = now.toISOString().split('T')[0];

  if (nowStr < promo.startDate) {
    return { isValid: false, discountAmount: 0, errorMessage: `This promotion starts on ${promo.startDate}.` };
  }
  if (nowStr > promo.endDate) {
    return { isValid: false, discountAmount: 0, errorMessage: 'This promotion has expired.' };
  }

  if (promo.usageLimitTotal != null && (promo.totalUsedCount || 0) >= promo.usageLimitTotal) {
    return { isValid: false, discountAmount: 0, errorMessage: 'This promotion has reached its maximum total usage limit.' };
  }

  if (customerId && (promo.usageLimitPerCustomer || 1) > 0) {
    const userUses = await db.collection('promotion_usages').countDocuments({
      companyId,
      promotionId: promo.id,
      customerId,
    });
    if (userUses >= promo.usageLimitPerCustomer) {
      return { isValid: false, discountAmount: 0, errorMessage: `You have reached the maximum uses (${promo.usageLimitPerCustomer}) for this promo.` };
    }
  }

  if (Array.isArray(promo.applicableDays) && promo.applicableDays.length > 0) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDay = dayNames[now.getDay()];
    if (!promo.applicableDays.includes(currentDay)) {
      return { isValid: false, discountAmount: 0, errorMessage: `This promo is only valid on ${promo.applicableDays.join(', ').toUpperCase()}.` };
    }
  }

  if (promo.isHappyHour && promo.happyHourStart && promo.happyHourEnd) {
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}:00`;
    if (currentTime < promo.happyHourStart || currentTime > promo.happyHourEnd) {
      return { isValid: false, discountAmount: 0, errorMessage: `Happy Hour is only active between ${promo.happyHourStart} and ${promo.happyHourEnd}.` };
    }
  }

  if (cartSubtotal < (promo.minCartValue || 0)) {
    return { isValid: false, discountAmount: 0, errorMessage: `Minimum cart value of ₹${Number(promo.minCartValue).toFixed(2)} required to use this promo.` };
  }

  let eligibleSubtotal = cartSubtotal;
  if (promo.applicableScope === 'specific_categories' && Array.isArray(promo.scopeIds)) {
    eligibleSubtotal = cartItems
      .filter((i) => i.categoryId && promo.scopeIds?.includes(i.categoryId))
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (eligibleSubtotal <= 0) {
      return { isValid: false, discountAmount: 0, errorMessage: 'None of the items in your cart qualify for this promotion.' };
    }
  } else if (promo.applicableScope === 'specific_products' && Array.isArray(promo.scopeIds)) {
    eligibleSubtotal = cartItems
      .filter((i) => promo.scopeIds?.includes(i.productId))
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (eligibleSubtotal <= 0) {
      return { isValid: false, discountAmount: 0, errorMessage: 'None of the items in your cart qualify for this promotion.' };
    }
  }

  let calculatedDiscount = 0;
  if (promo.promoType === 'percentage' || promo.promoType === 'happy_hour') {
    calculatedDiscount = eligibleSubtotal * ((promo.discountValue || 0) / 100);
    if (promo.maxDiscountAmount != null && promo.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, promo.maxDiscountAmount);
    }
  } else if (promo.promoType === 'flat_amount') {
    calculatedDiscount = Math.min(promo.discountValue || 0, eligibleSubtotal);
  } else if (promo.promoType === 'bogo') {
    if (promo.bogoBuyProductId && promo.bogoGetProductId) {
      const buyItem = cartItems.find((i) => i.productId === promo.bogoBuyProductId);
      let getItem = cartItems.find((i) => i.productId === promo.bogoGetProductId);
      if (!buyItem || buyItem.quantity < (promo.bogoBuyQuantity || 1)) {
        return { isValid: false, discountAmount: 0, errorMessage: `Add at least ${promo.bogoBuyQuantity || 1} of the required item to qualify for BOGO.` };
      }
      const sets = Math.floor(buyItem.quantity / (promo.bogoBuyQuantity || 1));
      const targetFreeQty = sets * (promo.bogoGetQuantity || 1);

      let autoAddProduct: any = null;
      if (!getItem) {
        const prod = await db.collection('products').findOne({ id: promo.bogoGetProductId, companyId });
        if (prod) {
          calculatedDiscount = targetFreeQty * (prod.price || 0);
          autoAddProduct = {
            product: prod,
            quantity: targetFreeQty,
          };
        } else {
          return { isValid: false, discountAmount: 0, errorMessage: 'Free BOGO item could not be found.' };
        }
      } else {
        const freeQty = Math.min(targetFreeQty, getItem.quantity);
        calculatedDiscount = freeQty * getItem.price;
      }

      calculatedDiscount = Math.min(
        calculatedDiscount,
        cartSubtotal + (autoAddProduct ? autoAddProduct.product.price * autoAddProduct.quantity : 0)
      );

      return {
        isValid: true,
        promotion: promo as unknown as Promotion,
        discountAmount: parseFloat(calculatedDiscount.toFixed(2)),
        autoAddProduct: autoAddProduct || undefined,
      };
    }
  } else {
    // Custom promotion type discount calculation
    if (promo.maxDiscountAmount != null && promo.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(eligibleSubtotal * ((promo.discountValue || 0) / 100), promo.maxDiscountAmount);
    } else {
      calculatedDiscount = eligibleSubtotal * ((promo.discountValue || 0) / 100);
    }
  }

  calculatedDiscount = Math.min(calculatedDiscount, cartSubtotal);

  return {
    isValid: true,
    promotion: promo as unknown as Promotion,
    discountAmount: parseFloat(calculatedDiscount.toFixed(2)),
  };
}

export async function getPromoStackingSetting(): Promise<boolean> {
  if (isLocalMySqlMode()) {
    const { getAuthorizedCompanyContext } = await import('@/lib/mysql-company');
    const comp = await getAuthorizedCompanyContext();
    const pool = (await import('@/lib/mysql')).getMysqlPool();
    const [rows]: any = await pool.query('SELECT allow_promo_stacking FROM companies WHERE id = ?', [comp.id]);
    return rows && rows[0] ? Boolean(rows[0].allow_promo_stacking) : false;
  }
  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const comp = await db.collection('companies').findOne({ id: companyId });
  return comp ? Boolean(comp.allowPromoStacking) : false;
}

export async function setPromoStackingSetting(allow: boolean): Promise<boolean> {
  if (isLocalMySqlMode()) {
    const { getAuthorizedCompanyContext, clearCompanyContextCache } = await import('@/lib/mysql-company');
    const comp = await getAuthorizedCompanyContext();
    const pool = (await import('@/lib/mysql')).getMysqlPool();
    await pool.query('UPDATE companies SET allow_promo_stacking = ? WHERE id = ?', [allow ? 1 : 0, comp.id]);
    clearCompanyContextCache(comp.id);
    return true;
  }
  const db = await getDb();
  const companyId = await getAuthCompanyId();
  await db.collection('companies').updateOne(
    { id: companyId },
    { $set: { allowPromoStacking: Boolean(allow) } },
    { upsert: true }
  );
  return true;
}
