import { getMysqlPool } from './mysql';
import { ensureLocalMySqlInitialized } from './mysql-init';
import { getAuthorizedCompanyPool, resolveCompanyPoolAndContext } from './mysql-company';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Promotion, PromotionUsage, PromotionValidationResult, PromotionType, PromotionScope } from '@/types/promotions';

function mapRowToPromotion(row: any): Promotion {
  let applicableDays: string[] | null = null;
  if (row.applicable_days_json) {
    try {
      applicableDays = typeof row.applicable_days_json === 'string'
        ? JSON.parse(row.applicable_days_json)
        : row.applicable_days_json;
    } catch {
      applicableDays = null;
    }
  }

  let scopeIds: string[] | null = null;
  if (row.scope_ids_json) {
    try {
      scopeIds = typeof row.scope_ids_json === 'string'
        ? JSON.parse(row.scope_ids_json)
        : row.scope_ids_json;
    } catch {
      scopeIds = null;
    }
  }

  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    title: row.title,
    description: row.description || null,
    promoType: row.promo_type as PromotionType,
    discountValue: Number(row.discount_value) || 0,
    maxDiscountAmount: row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    minCartValue: Number(row.min_cart_value) || 0,
    startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
    endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : '',
    isHappyHour: Boolean(row.is_happy_hour),
    happyHourStart: row.happy_hour_start || null,
    happyHourEnd: row.happy_hour_end || null,
    applicableDays,
    applicableScope: (row.applicable_scope || 'entire_bill') as PromotionScope,
    scopeIds,
    bogoBuyProductId: row.bogo_buy_product_id || null,
    bogoBuyQuantity: Number(row.bogo_buy_quantity) || 1,
    bogoGetProductId: row.bogo_get_product_id || null,
    bogoGetQuantity: Number(row.bogo_get_quantity) || 1,
    promotionalPrice: row.promotional_price != null ? Number(row.promotional_price) : null,
    usageLimitTotal: row.usage_limit_total != null ? Number(row.usage_limit_total) : null,
    usageLimitPerCustomer: Number(row.usage_limit_per_customer) || 1,
    totalUsedCount: Number(row.total_used_count) || 0,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function mysqlGetPromotions(companyIdParam?: string): Promise<Promotion[]> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await resolveCompanyPoolAndContext(companyIdParam);
  const companyId = company.id;

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM promotions WHERE company_id = ? ORDER BY is_active DESC, created_at DESC',
    [companyId]
  );

  return rows.map(mapRowToPromotion);
}

export async function mysqlCreatePromotion(data: Omit<Promotion, 'id' | 'companyId' | 'totalUsedCount' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await getAuthorizedCompanyPool();

  const id = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const code = data.code.trim().toUpperCase();

  await pool.query<ResultSetHeader>(
    `INSERT INTO promotions (
      id, company_id, code, title, description, promo_type, discount_value, max_discount_amount,
      min_cart_value, start_date, end_date, is_happy_hour, happy_hour_start, happy_hour_end,
      applicable_days_json, applicable_scope, scope_ids_json, bogo_buy_product_id, bogo_buy_quantity,
      bogo_get_product_id, bogo_get_quantity, promotional_price, usage_limit_total, usage_limit_per_customer, total_used_count, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      company.id,
      code,
      data.title.trim(),
      data.description || null,
      data.promoType || 'percentage',
      data.discountValue || 0,
      data.maxDiscountAmount || null,
      data.minCartValue || 0,
      data.startDate,
      data.endDate,
      data.isHappyHour ? 1 : 0,
      data.happyHourStart || null,
      data.happyHourEnd || null,
      data.applicableDays ? JSON.stringify(data.applicableDays) : null,
      data.applicableScope || 'entire_bill',
      data.scopeIds ? JSON.stringify(data.scopeIds) : null,
      data.bogoBuyProductId || null,
      data.bogoBuyQuantity || 1,
      data.bogoGetProductId || null,
      data.bogoGetQuantity || 1,
      data.promotionalPrice != null ? Number(data.promotionalPrice) : null,
      data.usageLimitTotal != null ? Number(data.usageLimitTotal) : null,
      data.usageLimitPerCustomer || 1,
      data.isActive !== false ? 1 : 0,
    ]
  );

  return {
    ...data,
    id,
    companyId: company.id,
    code,
    totalUsedCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function mysqlUpdatePromotion(id: string, updates: Partial<Promotion>): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await getAuthorizedCompanyPool();

  const clauses: string[] = [];
  const params: any[] = [];

  if (updates.code !== undefined) { clauses.push('code = ?'); params.push(updates.code.trim().toUpperCase()); }
  if (updates.title !== undefined) { clauses.push('title = ?'); params.push(updates.title.trim()); }
  if (updates.description !== undefined) { clauses.push('description = ?'); params.push(updates.description || null); }
  if (updates.promoType !== undefined) { clauses.push('promo_type = ?'); params.push(updates.promoType); }
  if (updates.discountValue !== undefined) { clauses.push('discount_value = ?'); params.push(Number(updates.discountValue)); }
  if (updates.maxDiscountAmount !== undefined) { clauses.push('max_discount_amount = ?'); params.push(updates.maxDiscountAmount != null ? Number(updates.maxDiscountAmount) : null); }
  if (updates.minCartValue !== undefined) { clauses.push('min_cart_value = ?'); params.push(Number(updates.minCartValue)); }
  if (updates.startDate !== undefined) { clauses.push('start_date = ?'); params.push(updates.startDate); }
  if (updates.endDate !== undefined) { clauses.push('end_date = ?'); params.push(updates.endDate); }
  if (updates.isHappyHour !== undefined) { clauses.push('is_happy_hour = ?'); params.push(updates.isHappyHour ? 1 : 0); }
  if (updates.happyHourStart !== undefined) { clauses.push('happy_hour_start = ?'); params.push(updates.happyHourStart || null); }
  if (updates.happyHourEnd !== undefined) { clauses.push('happy_hour_end = ?'); params.push(updates.happyHourEnd || null); }
  if (updates.applicableDays !== undefined) { clauses.push('applicable_days_json = ?'); params.push(updates.applicableDays ? JSON.stringify(updates.applicableDays) : null); }
  if (updates.applicableScope !== undefined) { clauses.push('applicable_scope = ?'); params.push(updates.applicableScope); }
  if (updates.scopeIds !== undefined) { clauses.push('scope_ids_json = ?'); params.push(updates.scopeIds ? JSON.stringify(updates.scopeIds) : null); }
  if (updates.bogoBuyProductId !== undefined) { clauses.push('bogo_buy_product_id = ?'); params.push(updates.bogoBuyProductId || null); }
  if (updates.bogoBuyQuantity !== undefined) { clauses.push('bogo_buy_quantity = ?'); params.push(Number(updates.bogoBuyQuantity)); }
  if (updates.bogoGetProductId !== undefined) { clauses.push('bogo_get_product_id = ?'); params.push(updates.bogoGetProductId || null); }
  if (updates.bogoGetQuantity !== undefined) { clauses.push('bogo_get_quantity = ?'); params.push(Number(updates.bogoGetQuantity)); }
  if (updates.promotionalPrice !== undefined) { clauses.push('promotional_price = ?'); params.push(updates.promotionalPrice != null ? Number(updates.promotionalPrice) : null); }
  if (updates.usageLimitTotal !== undefined) { clauses.push('usage_limit_total = ?'); params.push(updates.usageLimitTotal != null ? Number(updates.usageLimitTotal) : null); }
  if (updates.usageLimitPerCustomer !== undefined) { clauses.push('usage_limit_per_customer = ?'); params.push(Number(updates.usageLimitPerCustomer)); }
  if (updates.isActive !== undefined) { clauses.push('is_active = ?'); params.push(updates.isActive ? 1 : 0); }

  if (clauses.length === 0) return true;

  params.push(id, company.id);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE promotions SET ${clauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );
  return res.affectedRows > 0;
}

export async function mysqlDeletePromotion(id: string): Promise<boolean> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await getAuthorizedCompanyPool();

  await pool.query('DELETE FROM promotion_usages WHERE promotion_id = ? AND company_id = ?', [id, company.id]);
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM promotions WHERE id = ? AND company_id = ?', [id, company.id]);
  return res.affectedRows > 0;
}

/**
 * Validates a promotion code against current cart items, subtotal, and customer.
 */
export async function mysqlValidatePromotion(
  code: string,
  cartItems: { productId: string; categoryId?: string; price: number; quantity: number }[],
  cartSubtotal: number,
  customerId?: string | null,
  companyIdParam?: string
): Promise<PromotionValidationResult> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await resolveCompanyPoolAndContext(companyIdParam);
  const companyId = company.id;

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM promotions WHERE company_id = ? AND code = ? AND is_active = 1 LIMIT 1',
    [companyId, code.trim().toUpperCase()]
  );

  if (!rows || rows.length === 0) {
    return { isValid: false, discountAmount: 0, errorMessage: 'Invalid or inactive promo code.' };
  }

  const promo = mapRowToPromotion(rows[0]);
  const now = new Date();
  const nowStr = now.toISOString().split('T')[0];

  // 1. Date check
  if (nowStr < promo.startDate) {
    return { isValid: false, discountAmount: 0, errorMessage: `This promotion starts on ${promo.startDate}.` };
  }
  if (nowStr > promo.endDate) {
    return { isValid: false, discountAmount: 0, errorMessage: 'This promotion has expired.' };
  }

  // 2. Total usage limit check
  if (promo.usageLimitTotal != null && promo.totalUsedCount >= promo.usageLimitTotal) {
    return { isValid: false, discountAmount: 0, errorMessage: 'This promotion has reached its maximum total usage limit.' };
  }

  // 3. Customer usage limit check
  if (customerId && promo.usageLimitPerCustomer > 0) {
    const [usageRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM promotion_usages WHERE company_id = ? AND promotion_id = ? AND customer_id = ?',
      [companyId, promo.id, customerId]
    );
    const userUses = usageRows && usageRows[0] ? Number(usageRows[0].count) : 0;
    if (userUses >= promo.usageLimitPerCustomer) {
      return { isValid: false, discountAmount: 0, errorMessage: `You have reached the maximum uses (${promo.usageLimitPerCustomer}) for this promo.` };
    }
  }

  // 4. Day of week check
  if (Array.isArray(promo.applicableDays) && promo.applicableDays.length > 0) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDay = dayNames[now.getDay()];
    if (!promo.applicableDays.includes(currentDay)) {
      return { isValid: false, discountAmount: 0, errorMessage: `This promo is only valid on ${promo.applicableDays.join(', ').toUpperCase()}.` };
    }
  }

  // 5. Happy Hour time window check
  if (promo.isHappyHour && promo.happyHourStart && promo.happyHourEnd) {
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}:00`;
    if (currentTime < promo.happyHourStart || currentTime > promo.happyHourEnd) {
      return { isValid: false, discountAmount: 0, errorMessage: `Happy Hour is only active between ${promo.happyHourStart} and ${promo.happyHourEnd}.` };
    }
  }

  // 6. Minimum cart value check
  if (cartSubtotal < promo.minCartValue) {
    return { isValid: false, discountAmount: 0, errorMessage: `Minimum cart value of ₹${promo.minCartValue.toFixed(2)} required to use this promo.` };
  }

  // 7. Calculate Discount based on scope and type
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
    calculatedDiscount = eligibleSubtotal * (promo.discountValue / 100);
    if (promo.maxDiscountAmount != null && promo.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, promo.maxDiscountAmount);
    }
  } else if (promo.promoType === 'flat_amount') {
    calculatedDiscount = Math.min(promo.discountValue, eligibleSubtotal);
  } else if (promo.promoType === 'bogo') {
    // Buy X get Y free logic
    if (promo.bogoBuyProductId && promo.bogoGetProductId) {
      const buyItem = cartItems.find((i) => i.productId === promo.bogoBuyProductId);
      let getItem = cartItems.find((i) => i.productId === promo.bogoGetProductId);
      if (!buyItem || buyItem.quantity < (promo.bogoBuyQuantity || 1)) {
        let buyName = 'the required item';
        try {
          const [pRows]: any = await pool.query('SELECT name FROM products WHERE id = ?', [promo.bogoBuyProductId]);
          if (pRows?.[0]?.name) buyName = pRows[0].name;
        } catch {}
        return { isValid: false, discountAmount: 0, errorMessage: `Add at least ${promo.bogoBuyQuantity || 1} x ${buyName} to qualify for BOGO.` };
      }

      // Calculate how many free items can be given
      const sets = Math.floor(buyItem.quantity / (promo.bogoBuyQuantity || 1));
      const targetFreeQty = sets * (promo.bogoGetQuantity || 1);

      let autoAddProduct: any = null;

      if (!getItem) {
        // Auto-add the free item! Look up product details from MySQL:
        const [getProdRows]: any = await pool.query(
          'SELECT id, name, price, stock, unit, category_id, sku FROM products WHERE id = ?',
          [promo.bogoGetProductId]
        );
        if (getProdRows && getProdRows.length > 0) {
          const p = getProdRows[0];
          const autoProduct = {
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 999,
            unit: p.unit || 'pcs',
            categoryId: p.category_id || '',
            sku: p.sku || '',
            quantityStep: 1,
          };
          calculatedDiscount = targetFreeQty * autoProduct.price;
          autoAddProduct = {
            product: autoProduct,
            quantity: targetFreeQty,
          };
        } else {
          return { isValid: false, discountAmount: 0, errorMessage: 'Free BOGO item could not be found in product catalog.' };
        }
      } else {
        const freeQty = Math.min(targetFreeQty, getItem.quantity);
        calculatedDiscount = freeQty * getItem.price;

        if (getItem.quantity < targetFreeQty) {
          const addQty = targetFreeQty - getItem.quantity;
          const [getProdRows]: any = await pool.query(
            'SELECT id, name, price, stock, unit, category_id, sku FROM products WHERE id = ?',
            [promo.bogoGetProductId]
          );
          if (getProdRows && getProdRows.length > 0) {
            const p = getProdRows[0];
            autoAddProduct = {
              product: {
                id: p.id,
                name: p.name,
                price: Number(p.price) || 0,
                stock: Number(p.stock) || 999,
                unit: p.unit || 'pcs',
                categoryId: p.category_id || '',
                sku: p.sku || '',
                quantityStep: 1,
              },
              quantity: addQty,
            };
            calculatedDiscount = targetFreeQty * autoAddProduct.product.price;
          }
        }
      }

      calculatedDiscount = Math.min(
        calculatedDiscount,
        cartSubtotal + (autoAddProduct ? autoAddProduct.product.price * autoAddProduct.quantity : 0)
      );

      return {
        isValid: true,
        promotion: promo,
        discountAmount: parseFloat(calculatedDiscount.toFixed(2)),
        autoAddProduct: autoAddProduct || undefined,
      };
    }
  } else {
    // Custom promotion type: calculate percentage if maxDiscountAmount is set or <= 100, else flat amount
    if (promo.maxDiscountAmount != null && promo.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(eligibleSubtotal * (promo.discountValue / 100), promo.maxDiscountAmount);
    } else {
      calculatedDiscount = eligibleSubtotal * (promo.discountValue / 100);
    }
  }

  calculatedDiscount = Math.min(calculatedDiscount, cartSubtotal);

  return {
    isValid: true,
    promotion: promo,
    discountAmount: parseFloat(calculatedDiscount.toFixed(2)),
  };
}

/**
 * Records promotion usage when a sale is finalized.
 */
export async function mysqlRecordPromotionUsage(
  promotionId: string,
  promotionCode: string,
  saleId: string,
  discountAmount: number,
  customerId?: string | null,
  companyIdParam?: string
): Promise<void> {
  await ensureLocalMySqlInitialized();
  const { pool, company } = await resolveCompanyPoolAndContext(companyIdParam);
  const companyId = company.id;

  const id = `pu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await pool.query(
    `INSERT INTO promotion_usages (id, company_id, promotion_id, sale_id, customer_id, discount_amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [id, companyId, promotionId, saleId, customerId || null, discountAmount]
  );

  await pool.query(
    'UPDATE promotions SET total_used_count = total_used_count + 1 WHERE id = ? AND company_id = ?',
    [promotionId, companyId]
  );
}
