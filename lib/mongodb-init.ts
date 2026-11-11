import { isLocalMySqlMode } from '@/lib/mysql';
import clientPromise from '@/lib/mongodb';
import type { Db } from 'mongodb';

/**
 * Ensures MongoDB collections and compound indexes for:
 * 1. Batch & Expiry Date Tracking
 * 2. Customer Loyalty & Reward Points
 * 3. Discounts, Coupons & Promotions
 *
 * Safe to call idempotently. Strictly disabled in Local MySQL mode.
 * Uses a cached Promise to prevent duplicate simultaneous initialization
 * while ensuring concurrent requests await completion and failures can be retried.
 */
let indexInitPromise: Promise<{ success: boolean; message: string }> | null = null;

export async function ensureMongoIndexes(dbInstance?: Db): Promise<{ success: boolean; message: string }> {
  if (isLocalMySqlMode()) {
    return {
      success: true,
      message: 'Skipped MongoDB index initialization: running in Local MySQL mode.',
    };
  }

  if (indexInitPromise) {
    return indexInitPromise;
  }

  indexInitPromise = (async () => {
    let db = dbInstance;
    if (!db) {
      const client = await clientPromise;
      if (!client) {
        throw new Error('MongoDB client is not connected');
      }
      db = client.db();
    }

    // 1. product_batches
    await db.collection('product_batches').createIndex(
      { companyId: 1, itemType: 1, itemId: 1, batchNumber: 1 },
      { unique: true, background: true, name: 'idx_company_item_batch' }
    );
    await db.collection('product_batches').createIndex(
      { companyId: 1, expiryDate: 1 },
      { background: true, name: 'idx_company_expiry' }
    );
    await db.collection('product_batches').createIndex(
      { companyId: 1, status: 1 },
      { background: true, name: 'idx_company_status' }
    );

    // 2. batch_transactions
    await db.collection('batch_transactions').createIndex(
      { companyId: 1, batchId: 1, createdAt: -1 },
      { background: true, name: 'idx_company_batch_created' }
    );
    await db.collection('batch_transactions').createIndex(
      { companyId: 1, saleId: 1 },
      { background: true, name: 'idx_company_sale' }
    );

    // 3. loyalty_settings
    await db.collection('loyalty_settings').createIndex(
      { companyId: 1 },
      { unique: true, background: true, name: 'idx_company_loyalty_settings' }
    );

    // 4. loyalty_transactions
    await db.collection('loyalty_transactions').createIndex(
      { companyId: 1, customerId: 1, createdAt: -1 },
      { background: true, name: 'idx_company_customer_loyalty' }
    );
    await db.collection('loyalty_transactions').createIndex(
      { companyId: 1, saleId: 1 },
      { background: true, name: 'idx_company_sale_loyalty' }
    );

    // 5. promotions
    await db.collection('promotions').createIndex(
      { companyId: 1, code: 1 },
      { unique: true, background: true, name: 'idx_company_promo_code' }
    );
    await db.collection('promotions').createIndex(
      { companyId: 1, isActive: 1 },
      { background: true, name: 'idx_company_promo_active' }
    );
    await db.collection('promotions').createIndex(
      { companyId: 1, startDate: 1, endDate: 1 },
      { background: true, name: 'idx_company_promo_dates' }
    );

    // 6. promotion_usages
    await db.collection('promotion_usages').createIndex(
      { companyId: 1, promotionId: 1, customerId: 1 },
      { background: true, name: 'idx_company_promo_customer_usage' }
    );
    await db.collection('promotion_usages').createIndex(
      { companyId: 1, saleId: 1 },
      { background: true, name: 'idx_company_promo_sale' }
    );

    return {
      success: true,
      message: 'MongoDB collections and compound indexes initialized successfully.',
    };
  })().catch((err: any) => {
    // Reset cached promise so that subsequent attempts can retry
    indexInitPromise = null;
    console.error('ensureMongoIndexes error:', err?.message || err);
    throw err;
  });

  return indexInitPromise;
}
