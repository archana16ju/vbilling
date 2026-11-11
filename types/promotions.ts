export type PromotionType = 'percentage' | 'flat_amount' | 'bogo' | 'happy_hour' | (string & {});
export type PromotionScope = 'entire_bill' | 'specific_categories' | 'specific_products';

export interface Promotion {
  id: string;
  companyId: string;
  code: string; // e.g. "SAVE10", "FESTIVE100"
  title: string;
  description?: string | null;
  promoType: PromotionType;
  discountValue: number; // e.g. 10 (10% or Rs. 10)
  maxDiscountAmount?: number | null; // Cap on percentage discount
  minCartValue: number; // Minimum subtotal required
  startDate: string; // ISO date or YYYY-MM-DD
  endDate: string; // ISO date or YYYY-MM-DD
  isHappyHour: boolean;
  happyHourStart?: string | null; // "HH:MM:SS" e.g. "16:00:00"
  happyHourEnd?: string | null; // "HH:MM:SS" e.g. "19:00:00"
  applicableDays?: string[] | null; // ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  applicableScope: PromotionScope;
  scopeIds?: string[] | null; // category IDs or product IDs
  bogoBuyProductId?: string | null;
  bogoBuyQuantity: number;
  bogoGetProductId?: string | null;
  bogoGetQuantity: number;
  promotionalPrice?: number | null;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer: number;
  totalUsedCount: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PromotionUsage {
  id: string;
  companyId: string;
  promotionId: string;
  promotionCode: string;
  saleId: string;
  customerId?: string | null;
  customerName?: string | null;
  discountAmount: number;
  createdAt: number;
}

export interface PromotionValidationResult {
  isValid: boolean;
  promotion?: Promotion;
  discountAmount: number;
  errorMessage?: string;
  bogoFreeItems?: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  autoAddProduct?: {
    product: any;
    quantity: number;
  };
}
