export type ProductUnit =
  | "piece"
  | "kg"
  | "g"
  | "liter"
  | "ml"
  | "box"
  | "pack"
  | "dozen"

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  stock: number
  unit: ProductUnit
  quantityStep: number
  categoryId: string
  image?: string
}