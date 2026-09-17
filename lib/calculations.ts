import { Product } from "./mock-data"

export type CartItemData = {
  product: Product
  quantity: number
}

export const calculateItemSubtotal = (item: CartItemData): number => {
  return item.product.price * item.quantity
}

export const calculateItemDiscount = (item: CartItemData): number => {
  const subtotal = calculateItemSubtotal(item)
  const discountRate = item.product.discount || 0
  return subtotal * (discountRate / 100)
}

export const calculateItemTax = (item: CartItemData): number => {
  const subtotal = calculateItemSubtotal(item)
  const discount = calculateItemDiscount(item)
  const afterDiscount = subtotal - discount
  // If no tax is set on product, assume 0
  const taxRate = item.product.tax || 0
  return afterDiscount * (taxRate / 100)
}

export const calculateItemTotal = (item: CartItemData): number => {
  return calculateItemSubtotal(item) - calculateItemDiscount(item) + calculateItemTax(item)
}

export const calculateSubtotal = (items: CartItemData[]): number => {
  return items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0)
}

export const calculateTotalDiscount = (items: CartItemData[]): number => {
  return items.reduce((sum, item) => sum + calculateItemDiscount(item), 0)
}

export const calculateTotalTax = (items: CartItemData[]): number => {
  return items.reduce((sum, item) => sum + calculateItemTax(item), 0)
}

export const calculateTotal = (items: CartItemData[]): number => {
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
