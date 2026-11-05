import { Product } from "./mock-data"
import { SelectedAddon } from "@/types/addons"

export type CartItemData = {
  product: Product
  quantity: number
  notes?: string
  lineId?: string
  selectedAddOns?: SelectedAddon[]
}

export const calculateItemAddonsUnitPrice = (item: CartItemData): number => {
  if (!item || !Array.isArray(item.selectedAddOns)) return 0;
  return item.selectedAddOns.reduce((sum, a) => sum + ((Number(a.price) || 0) * (Number(a.quantity) || 1)), 0);
}

export const calculateItemSubtotal = (item: CartItemData): number => {
  if (!item || !item.product) return 0;
  const addonsUnitPrice = calculateItemAddonsUnitPrice(item);
  const unitPrice = (Number(item.product.price) || 0) + addonsUnitPrice;
  return unitPrice * (Number(item.quantity) || 0);
}

export const calculateItemDiscount = (item: CartItemData): number => {
  if (!item || !item.product) return 0;
  const subtotal = calculateItemSubtotal(item)
  const discountRate = item.product.discount || 0
  return subtotal * (discountRate / 100)
}

export const calculateItemTax = (item: CartItemData): number => {
  if (!item || !item.product) return 0;
  const qty = Number(item.quantity) || 0;
  const basePrice = Number(item.product.price) || 0;
  const discountRate = Number(item.product.discount) || 0;
  const baseDiscount = (basePrice * qty) * (discountRate / 100);
  const baseTaxable = (basePrice * qty) - baseDiscount;
  const baseTax = baseTaxable * ((Number(item.product.tax) || 0) / 100);

  let addonsTax = 0;
  if (Array.isArray(item.selectedAddOns)) {
    for (const a of item.selectedAddOns) {
      const aPrice = (Number(a.price) || 0) * (Number(a.quantity) || 1) * qty;
      const aTaxRate = a.tax !== undefined && a.tax !== null ? Number(a.tax) : (Number(item.product.tax) || 0);
      addonsTax += aPrice * (aTaxRate / 100);
    }
  }

  return baseTax + addonsTax;
}

export const calculateItemCgst = (item: CartItemData): { rate: number; amount: number } => {
  if (!item || !item.product) return { rate: 0, amount: 0 };
  const tax = calculateItemTax(item);
  const taxRate = (item.product.tax || 0) / 2;
  return {
    rate: taxRate,
    amount: tax / 2
  };
}

export const calculateItemSgst = (item: CartItemData): { rate: number; amount: number } => {
  if (!item || !item.product) return { rate: 0, amount: 0 };
  const tax = calculateItemTax(item);
  const taxRate = (item.product.tax || 0) / 2;
  return {
    rate: taxRate,
    amount: tax / 2
  };
}

export const calculateItemTotal = (item: CartItemData): number => {
  return calculateItemSubtotal(item) - calculateItemDiscount(item) + calculateItemTax(item)
}

export const calculateSubtotal = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0)
}

export const calculateTotalDiscount = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemDiscount(item), 0)
}

export const calculateTotalTax = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemTax(item), 0)
}

export const calculateTotalCgst = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemCgst(item).amount, 0);
}

export const calculateTotalSgst = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemSgst(item).amount, 0);
}

export const calculateTotal = (items: CartItemData[]): number => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
}

export const calculateDiscount = (subtotal: number, discountValue: number, isPercentage: boolean): number => {
  if (isPercentage) {
    return subtotal * (discountValue / 100)
  }
  return discountValue
}

export const calculateTax = (amountAfterDiscount: number, taxRate: number = 0): number => {
  return amountAfterDiscount * taxRate
}

export const calculateGlobalTotal = (subtotal: number, discountAmount: number, taxAmount: number): number => {
  return subtotal - discountAmount + taxAmount
}

export type RoundOffMethod = 'nearest' | 'custom' | 'down' | 'up' | 'none';

export const calculateRoundOff = (
  exactTotal: number,
  enabled: boolean,
  method: RoundOffMethod = 'nearest',
  belowThreshold: number = 0.49,
  aboveThreshold: number = 0.50
): { roundOffAmount: number; grandTotal: number } => {
  if (!enabled || method === 'none') {
    return {
      roundOffAmount: 0,
      grandTotal: parseFloat(exactTotal.toFixed(2)),
    };
  }

  let rounded = exactTotal;
  if (method === 'down') {
    // Always round down to the nearest whole rupee
    rounded = Math.floor(exactTotal);
  } else if (method === 'up') {
    // Always round up to the next whole rupee when there is a decimal amount
    rounded = Math.ceil(exactTotal);
  } else {
    // 'nearest' or 'custom' (Threshold-based rounding)
    const integerPart = Math.floor(exactTotal);
    const paise = parseFloat((exactTotal - integerPart).toFixed(2));
    const below = typeof belowThreshold === 'number' ? belowThreshold : 0.49;
    
    // Amounts with paise up to belowThreshold round down; from aboveThreshold onwards round up
    if (paise <= below) {
      rounded = integerPart;
    } else {
      rounded = integerPart + 1;
    }
  }

  const roundOffAmount = parseFloat((rounded - exactTotal).toFixed(2));
  return {
    roundOffAmount,
    grandTotal: parseFloat(rounded.toFixed(2)),
  };
};
