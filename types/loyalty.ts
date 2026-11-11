export type LoyaltyTier = 'Silver' | 'Gold' | 'Platinum';
export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'expired' | 'adjustment' | 'refund_reversal';

export interface LoyaltySettings {
  companyId: string;
  isEnabled: boolean;
  pointsPerAmount: number; // e.g. 100 => 1 point per 100 currency units
  amountPerPoint: number; // e.g. 1.00 => 1 point = Rs. 1.00 discount
  minPointsToRedeem: number; // e.g. 50
  maxRedeemPercentPerBill: number; // e.g. 50%
  minBillAmountToEarn: number; // e.g. 100
  silverThreshold: number; // e.g. 0
  goldThreshold: number; // e.g. 500
  platinumThreshold: number; // e.g. 1500
  silverMultiplier: number; // e.g. 1.0
  goldMultiplier: number; // e.g. 1.25
  platinumMultiplier: number; // e.g. 1.5
  expiryMonths: number; // 0 = never
  updatedAt: number;
}

export const DEFAULT_LOYALTY_SETTINGS: Omit<LoyaltySettings, 'companyId' | 'updatedAt'> = {
  isEnabled: true,
  pointsPerAmount: 100,
  amountPerPoint: 1.0,
  minPointsToRedeem: 50,
  maxRedeemPercentPerBill: 50,
  minBillAmountToEarn: 100,
  silverThreshold: 0,
  goldThreshold: 500,
  platinumThreshold: 1500,
  silverMultiplier: 1.0,
  goldMultiplier: 1.25,
  platinumMultiplier: 1.5,
  expiryMonths: 12,
};

export interface LoyaltyTransaction {
  id: string;
  companyId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  saleId?: string | null;
  type: LoyaltyTransactionType;
  points: number; // positive for earned, negative for redeemed
  balanceAfter: number;
  monetaryValue: number;
  note?: string | null;
  createdAt: number;
}
