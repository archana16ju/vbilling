'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { getDb } from './db';
import { getSession } from '@/lib/auth-session';
import { LoyaltySettings, DEFAULT_LOYALTY_SETTINGS, LoyaltyTransaction, LoyaltyTier } from '@/types/loyalty';
import {
  mysqlGetLoyaltySettings,
  mysqlSaveLoyaltySettings,
  mysqlGetCustomerLoyaltyHistory,
  mysqlProcessLoyaltyTransaction,
  calculateTier,
} from '@/lib/mysql-loyalty';

async function getAuthCompanyId(): Promise<string> {
  const session = await getSession();
  if (!session || !session.companyId) {
    return 'comp_default';
  }
  return session.companyId;
}

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  if (isLocalMySqlMode()) {
    return await mysqlGetLoyaltySettings();
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const found = await db.collection('loyalty_settings').findOne({ companyId });

  if (!found) {
    return {
      ...DEFAULT_LOYALTY_SETTINGS,
      companyId,
      updatedAt: Date.now(),
    };
  }

  return {
    companyId: found.companyId,
    isEnabled: Boolean(found.isEnabled),
    pointsPerAmount: Number(found.pointsPerAmount) || 100,
    amountPerPoint: Number(found.amountPerPoint) || 1.0,
    minPointsToRedeem: Number(found.minPointsToRedeem) || 50,
    maxRedeemPercentPerBill: Number(found.maxRedeemPercentPerBill) || 50,
    minBillAmountToEarn: Number(found.minBillAmountToEarn) || 100,
    silverThreshold: Number(found.silverThreshold) || 0,
    goldThreshold: Number(found.goldThreshold) || 500,
    platinumThreshold: Number(found.platinumThreshold) || 1500,
    silverMultiplier: Number(found.silverMultiplier) || 1.0,
    goldMultiplier: Number(found.goldMultiplier) || 1.25,
    platinumMultiplier: Number(found.platinumMultiplier) || 1.5,
    expiryMonths: Number(found.expiryMonths) || 12,
    updatedAt: found.updatedAt || Date.now(),
  };
}

export async function saveLoyaltySettings(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
  if (isLocalMySqlMode()) {
    return await mysqlSaveLoyaltySettings(settings);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const merged: LoyaltySettings = {
    ...DEFAULT_LOYALTY_SETTINGS,
    ...settings,
    companyId,
    updatedAt: Date.now(),
  };

  await db.collection('loyalty_settings').updateOne(
    { companyId },
    { $set: merged },
    { upsert: true }
  );

  return merged;
}

export async function getCustomerLoyaltyHistory(customerId: string): Promise<LoyaltyTransaction[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetCustomerLoyaltyHistory(customerId);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const rows = await db.collection('loyalty_transactions')
    .find({ companyId, customerId })
    .sort({ createdAt: -1 })
    .toArray();

  return rows.map((r: any) => ({
    id: r.id || r._id.toString(),
    companyId: r.companyId,
    customerId: r.customerId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    saleId: r.saleId || null,
    type: r.type,
    points: Number(r.points) || 0,
    balanceAfter: Number(r.balanceAfter) || 0,
    monetaryValue: Number(r.monetaryValue) || 0,
    note: r.note || null,
    createdAt: r.createdAt || Date.now(),
  }));
}

export async function processLoyaltyTransaction(
  customerId: string,
  pointsChange: number,
  type: 'earned' | 'redeemed' | 'adjustment' | 'refund_reversal',
  saleId?: string | null,
  note?: string | null
): Promise<{ success: boolean; newBalance: number; tier: LoyaltyTier }> {
  if (isLocalMySqlMode()) {
    return await mysqlProcessLoyaltyTransaction(customerId, pointsChange, type, saleId, note);
  }

  const db = await getDb();
  const companyId = await getAuthCompanyId();
  const settings = await getLoyaltySettings();

  const customer = await db.collection('customers').findOne({ id: customerId, companyId });
  if (!customer) {
    throw new Error('Customer not found for loyalty transaction.');
  }

  const currentBalance = Number(customer.loyaltyPointsBalance) || 0;
  const currentEarned = Number(customer.totalPointsEarned) || 0;
  const currentRedeemed = Number(customer.totalPointsRedeemed) || 0;

  let newBalance = Math.max(0, currentBalance + pointsChange);
  let newEarned = currentEarned + (pointsChange > 0 ? pointsChange : 0);
  let newRedeemed = currentRedeemed + (pointsChange < 0 ? Math.abs(pointsChange) : 0);
  const newTier = calculateTier(newEarned, settings);

  await db.collection('customers').updateOne(
    { id: customerId, companyId },
    {
      $set: {
        loyaltyPointsBalance: newBalance,
        loyaltyTier: newTier,
        totalPointsEarned: newEarned,
        totalPointsRedeemed: newRedeemed,
      },
    }
  );

  const txId = `ltx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const monetaryVal = Math.abs(pointsChange) * settings.amountPerPoint;

  await db.collection('loyalty_transactions').insertOne({
    id: txId,
    companyId,
    customerId,
    saleId: saleId || null,
    type,
    points: pointsChange,
    balanceAfter: newBalance,
    monetaryValue: monetaryVal,
    note: note || null,
    createdAt: Date.now(),
  });

  return { success: true, newBalance, tier: newTier };
}
