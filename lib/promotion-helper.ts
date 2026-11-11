import { Product } from '@/lib/mock-data';
import { Promotion } from '@/types/promotions';

export interface ProductPromotionTag {
  tag: string;
  badgeType: 'bogo' | 'discount' | 'happy_hour';
  title: string;
  code: string;
  minCartValue: number;
  promotionalPrice?: number;
}

/**
 * Returns the most relevant active promotion tag for a product,
 * taking into account BOGO triggers, category/product scope, and min cart value.
 */
export function getProductPromotionTag(
  product: Product,
  promotions: Promotion[]
): ProductPromotionTag | null {
  if (!product || !Array.isArray(promotions) || promotions.length === 0) return null;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = dayNames[now.getDay()];

  // Active promotions within date and day range
  const activePromos = promotions.filter((p) => {
    if (!p.isActive) return false;
    const sDate = p.startDate ? String(p.startDate).split('T')[0] : '';
    const eDate = p.endDate ? String(p.endDate).split('T')[0] : '';
    if (sDate && todayStr < sDate) return false;
    if (eDate && todayStr > eDate) return false;
    if (Array.isArray(p.applicableDays) && p.applicableDays.length > 0 && !p.applicableDays.includes(currentDay)) {
      return false;
    }
    return true;
  });

  for (const promo of activePromos) {
    // 1. Check BOGO
    if (promo.promoType === 'bogo') {
      if (promo.bogoBuyProductId === product.id) {
        return {
          tag: promo.minCartValue > 0 ? `🎁 BOGO (Min ₹${promo.minCartValue})` : '🎁 BUY 1 GET 1',
          badgeType: 'bogo',
          title: promo.title,
          code: promo.code,
          minCartValue: promo.minCartValue,
          promotionalPrice: promo.promotionalPrice != null ? promo.promotionalPrice : undefined,
        };
      }
      if (promo.bogoGetProductId === product.id) {
        return {
          tag: '🎁 GET FREE (BOGO)',
          badgeType: 'bogo',
          title: promo.title,
          code: promo.code,
          minCartValue: promo.minCartValue,
          promotionalPrice: 0,
        };
      }
    }

    // 2. Check Specific Product
    if (promo.applicableScope === 'specific_products' && Array.isArray(promo.scopeIds) && promo.scopeIds.includes(product.id)) {
      const discountLabel = promo.promoType === 'percentage'
        ? `${promo.discountValue}% OFF`
        : `₹${promo.discountValue} OFF`;
      return {
        tag: promo.minCartValue > 0 ? `🔥 ${discountLabel} (Min ₹${promo.minCartValue})` : `🔥 ${discountLabel}`,
        badgeType: 'discount',
        title: promo.title,
        code: promo.code,
        minCartValue: promo.minCartValue,
        promotionalPrice: promo.promoType === 'percentage'
          ? Math.max(0, product.price - (promo.maxDiscountAmount ? Math.min((product.price * promo.discountValue) / 100, promo.maxDiscountAmount) : (product.price * promo.discountValue) / 100))
          : promo.promoType === 'flat_amount'
          ? Math.max(0, product.price - promo.discountValue)
          : product.price,
      };
    }

    // 3. Check Specific Category
    if (promo.applicableScope === 'specific_categories' && Array.isArray(promo.scopeIds) && promo.scopeIds.includes(product.categoryId)) {
      const discountLabel = promo.promoType === 'percentage'
        ? `${promo.discountValue}% OFF`
        : `₹${promo.discountValue} OFF`;
      return {
        tag: promo.minCartValue > 0 ? `🔥 ${discountLabel} (Min ₹${promo.minCartValue})` : `🔥 ${discountLabel}`,
        badgeType: 'discount',
        title: promo.title,
        code: promo.code,
        minCartValue: promo.minCartValue,
        promotionalPrice: promo.promoType === 'percentage'
          ? Math.max(0, product.price - (promo.maxDiscountAmount ? Math.min((product.price * promo.discountValue) / 100, promo.maxDiscountAmount) : (product.price * promo.discountValue) / 100))
          : promo.promoType === 'flat_amount'
          ? Math.max(0, product.price - promo.discountValue)
          : product.price,
      };
    }

    // 4. Check Happy Hour
    if (promo.isHappyHour) {
      const matchesScope =
        promo.applicableScope === 'entire_bill' ||
        (Array.isArray(promo.scopeIds) && (promo.scopeIds.includes(product.id) || promo.scopeIds.includes(product.categoryId)));
      if (matchesScope) {
        return {
          tag: promo.minCartValue > 0 ? `⚡ Happy Hour (Min ₹${promo.minCartValue})` : '⚡ Happy Hour',
          badgeType: 'happy_hour',
          title: promo.title,
          code: promo.code,
          minCartValue: promo.minCartValue,
        };
      }
    }
  }

  return null;
}
