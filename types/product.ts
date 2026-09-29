export type ProductUnit =
  | "piece"
  | "kg"
  | "g"
  | "liter"
  | "ml"
  | "box"
  | "pack"
  | "dozen"
  | "tsp"
  | "tbsp"
  | "cup"

export interface RecipeItem {
  rawMaterialId: string
  quantity: number
  unit: ProductUnit
}

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
  
  // Recipe Additions
  recipeYield?: number
  recipeUnit?: ProductUnit
  rawMaterials?: RecipeItem[]
}

export interface RawMaterial {
  id: string
  name: string
  unit: ProductUnit
  currentStock: number
  minimumStock: number
  isActive: boolean
  lastUpdated?: number
}

export interface StockTransaction {
  id: string
  rawMaterialId: string
  type: 'Opening Stock' | 'Stock Added' | 'Stock Deduction' | 'Stock Adjustment' | 'Stock Return' | 'Wastage' | 'Manual Correction' | 'Production' | 'Bill Cancelled/Refund'
  quantityBefore: number
  quantityChanged: number
  quantityAfter: number
  date: number
  reason?: string
  referenceId?: string // Bill ID or production ID
}