import { getMysqlPool } from './mysql';
import { ensureLocalMySqlInitialized } from './mysql-init';
import { getAuthorizedCompanyContext } from './mysql-company';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { LoyaltySettings, DEFAULT_LOYALTY_SETTINGS, LoyaltyTransaction, LoyaltyTier } from '@/types/loyalty';

function mapRowToLoyaltySettings(row: any): LoyaltySettings {
  return {
    companyId: row.company_id,
    isEnabled: Boolean(row.is_enabled),
    pointsPerAmount: Number(row.points_per_amount) || 100,
    amountPerPoint: Number(row.amount_per_point) || 1.0,
    minPointsToRedeem: Number(row.min_points_to_redeem) || 50,
    maxRedeemPercentPerBill: Number(row.max_redeem_percent_per_bill) || 50,
    minBillAmountToEarn: Number(row.min_bill_amount_to_earn) || 100,
    silverThreshold: Number(row.silver_threshold) || 0,
    goldThreshold: Number(row.gold_threshold) || 500,
    platinumThreshold: Number(row.platinum_threshold) || 1500,
    silverMultiplier: Number(row.silver_multiplier) || 1.0,
    goldMultiplier: Number(row.gold_multiplier) || 1.25,
    platinumMultiplier: Number(row.platinum_multiplier) || 1.5,
    expiryMonths: Number(row.expiry_months) || 12,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function mysqlGetLoyaltySettings(companyIdParam?: string): Promise<LoyaltySettings> {
  await ensureLocalMySqlInitialized();
  let companyId = companyIdParam;
  if (!companyId) {
    const comp = await getAuthorizedCompanyContext();
    companyId = comp.id;
  }
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM loyalty_settings WHERE company_id = ? LIMIT 1',
    [companyId]
  );

  if (!rows || rows.length === 0) {
    // Return default settings for company
    return {
      ...DEFAULT_LOYALTY_SETTINGS,
      companyId,
      updatedAt: Date.now(),
    };
  }

  return mapRowToLoyaltySettings(rows[0]);
}

export async function mysqlSaveLoyaltySettings(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const merged = {
    ...DEFAULT_LOYALTY_SETTINGS,
    ...settings,
    companyId: company.id,
  };

  await pool.query(
    `INSERT INTO loyalty_settings (
      company_id, is_enabled, points_per_amount, amount_per_point, min_points_to_redeem,
      max_redeem_percent_per_bill, min_bill_amount_to_earn, silver_threshold, gold_threshold,
      platinum_threshold, silver_multiplier, gold_multiplier, platinum_multiplier, expiry_months
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      is_enabled = VALUES(is_enabled),
      points_per_amount = VALUES(points_per_amount),
      amount_per_point = VALUES(amount_per_point),
      min_points_to_redeem = VALUES(min_points_to_redeem),
      max_redeem_percent_per_bill = VALUES(max_redeem_percent_per_bill),
      min_bill_amount_to_earn = VALUES(min_bill_amount_to_earn),
      silver_threshold = VALUES(silver_threshold),
      gold_threshold = VALUES(gold_threshold),
      platinum_threshold = VALUES(platinum_threshold),
      silver_multiplier = VALUES(silver_multiplier),
      gold_multiplier = VALUES(gold_multiplier),
      platinum_multiplier = VALUES(platinum_multiplier),
      expiry_months = VALUES(expiry_months),
      updated_at = NOW()`,
    [
      company.id,
      merged.isEnabled ? 1 : 0,
      merged.pointsPerAmount,
      merged.amountPerPoint,
      merged.minPointsToRedeem,
      merged.maxRedeemPercentPerBill,
      merged.minBillAmountToEarn,
      merged.silverThreshold,
      merged.goldThreshold,
      merged.platinumThreshold,
      merged.silverMultiplier,
      merged.goldMultiplier,
      merged.platinumMultiplier,
      merged.expiryMonths,
    ]
  );

  return {
    ...merged,
    updatedAt: Date.now(),
  };
}

export async function mysqlGetCustomerLoyaltyHistory(customerId: string): Promise<LoyaltyTransaction[]> {
  await ensureLocalMySqlInitialized();
  const company = await getAuthorizedCompanyContext();
  const pool = getMysqlPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT lt.*, c.name as customer_name, c.phone as customer_phone
     FROM loyalty_transactions lt
     LEFT JOIN customers c ON lt.customer_id = c.id AND c.company_id = lt.company_id
     WHERE lt.company_id = ? AND lt.customer_id = ?
     ORDER BY lt.created_at DESC`,
    [company.id, customerId]
  );

  return rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    customerId: r.customer_id,
    customerName: r.customer_name || undefined,
    customerPhone: r.customer_phone || undefined,
    saleId: r.sale_id || null,
    type: r.type,
    points: Number(r.points) || 0,
    balanceAfter: Number(r.balance_after) || 0,
    monetaryValue: Number(r.monetary_value) || 0,
    note: r.note || null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}

/**
 * Calculates tier based on total points earned
 */
export function calculateTier(totalPointsEarned: number, settings: LoyaltySettings): LoyaltyTier {
  if (totalPointsEarned >= settings.platinumThreshold) return 'Platinum';
  if (totalPointsEarned >= settings.goldThreshold) return 'Gold';
  return 'Silver';
}

/**
 * Awards or redeems loyalty points atomically for a customer.
 */
export async function mysqlProcessLoyaltyTransaction(
  customerId: string,
  pointsChange: number, // positive for earn, negative for redeem
  type: 'earned' | 'redeemed' | 'adjustment' | 'refund_reversal',
  saleId?: string | null,
  note?: string | null,
  companyIdParam?: string
): Promise<{ success: boolean; newBalance: number; tier: LoyaltyTier }> {
  await ensureLocalMySqlInitialized();
  let companyId = companyIdParam;
  if (!companyId) {
    const comp = await getAuthorizedCompanyContext();
    companyId = comp.id;
  }
  const pool = getMysqlPool();

  const settings = await mysqlGetLoyaltySettings(companyId);
  if (!settings.isEnabled && type === 'earned') {
    return { success: false, newBalance: 0, tier: 'Silver' };
  }

  // Lock customer row
  const [custRows] = await pool.query<RowDataPacket[]>(
    'SELECT loyalty_points_balance, total_points_earned, total_points_redeemed FROM customers WHERE id = ? AND company_id = ? FOR UPDATE',
    [customerId, companyId]
  );

  if (!custRows || custRows.length === 0) {
    throw new Error('Customer not found for loyalty transaction.');
  }

  const currentBalance = Number(custRows[0].loyalty_points_balance) || 0;
  const currentEarned = Number(custRows[0].total_points_earned) || 0;
  const currentRedeemed = Number(custRows[0].total_points_redeemed) || 0;

  let newBalance = currentBalance + pointsChange;
  if (newBalance < 0) {
    newBalance = 0; // Prevent negative points
  }

  let newEarned = currentEarned;
  let newRedeemed = currentRedeemed;

  if (pointsChange > 0) {
    newEarned += pointsChange;
  } else if (pointsChange < 0) {
    newRedeemed += Math.abs(pointsChange);
  }

  const newTier = calculateTier(newEarned, settings);

  // Update customer
  await pool.query(
    `UPDATE customers SET 
      loyalty_points_balance = ?, 
      loyalty_tier = ?, 
      total_points_earned = ?, 
      total_points_redeemed = ? 
     WHERE id = ? AND company_id = ?`,
    [newBalance, newTier, newEarned, newRedeemed, customerId, companyId]
  );

  // Insert ledger entry
  const txId = `ltx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const monetaryVal = Math.abs(pointsChange) * settings.amountPerPoint;

  await pool.query(
    `INSERT INTO loyalty_transactions (
      id, company_id, customer_id, sale_id, type, points, balance_after, monetary_value, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [txId, companyId, customerId, saleId || null, type, pointsChange, newBalance, monetaryVal, note || null]
  );

  return { success: true, newBalance, tier: newTier };
}
