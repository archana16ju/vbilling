export type ProductUnit =
  | "piece"
  | "pcs"
  | "kg"
  | "g"
  | "liter"
  | "L"
  | "ml"
  | "box"
  | "pack"
  | "pkt"
  | "dozen"
  | "bag"
  | "bottle"
  | "bunch"
  | "tin"
  | "tsp"
  | "tbsp"
  | "cup"
  | string;

export type BarcodeFormat = 'CODE128' | 'EAN13' | 'UPCA';
export type BarcodeType = 'internal' | 'manufacturer' | 'INTERNAL' | 'MANUFACTURER';

export interface ProductBarcode {
  id?: string;
  companyId?: string;
  productId?: string;
  barcode: string;
  barcodeType: BarcodeType;
  barcodeFormat: BarcodeFormat;
  isPrimary?: boolean;
  createdAt?: number;
}

export interface RecipeItem {
  rawMaterialId: string
  quantity: number
  unit: ProductUnit
}

export interface LinkedProductRef {
  productId: string
  productName?: string
  quantity: number
  unit: ProductUnit
}

export interface Product {
  id: string
  companyId?: string
  name: string
  sku: string
  barcode?: string
  price: number
  stock: number
  unit: ProductUnit
  quantityStep: number
  categoryId: string
  image?: string
  tax?: number
  discount?: number
  minStockLevel?: number
  minStock?: number
  
  // Recipe Additions
  recipeYield?: number
  recipeUnit?: ProductUnit
  rawMaterials?: RecipeItem[]
  addonGroupIds?: string[]
  barcodes?: ProductBarcode[]
  isBatchTracked?: boolean
  supplierName?: string
  preferredSupplier?: string
}

export interface RawMaterial {
  id: string
  name: string
  unit: ProductUnit
  currentStock: number
  minimumStock: number
  targetStock?: number
  isActive: boolean
  lastUpdated?: number
  purchaseUnit?: string
  conversionFactor?: number
  category?: string
  supplierId?: string
  supplierName?: string
  preferredSupplier?: string
  shelfLifeDays?: number
  costPerUnit?: number
  linkedProducts?: LinkedProductRef[]
  status?: 'In Stock' | 'Low Stock' | 'Replenished' | 'Out of Stock' | string
  lastReplenishedAt?: number
}

export interface StockTransaction {
  id: string
  companyId?: string
  rawMaterialId: string
  rawMaterialName?: string
  type: 'Opening Stock' | 'Stock Added' | 'Stock Deduction' | 'Sale Deduction' | 'Auto Replenishment' | 'Manual Adjustment' | 'Stock Adjustment' | 'Stock Return' | 'Wastage' | 'Manual Correction' | 'Production' | 'Bill Cancelled/Refund' | string
  quantityBefore: number
  quantityChanged: number
  quantityAfter: number
  date: number
  reason?: string
  referenceId?: string // Bill ID or production ID
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  balanceOwed?: number
  companyId?: string
}

export interface PurchaseOrderItem {
  id?: string
  name: string
  orderedQty: number
  unit?: string
  deliveredQty: number
  stillOwedQty: number
  rate: number
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDate?: string
  totalAmount: number
  paidAmount: number
  owedAmount: number
  state: 'Draft' | 'Pending' | 'Part delivered' | 'Delivered' | 'Cancelled' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Ordered' | string
  itemsJson?: string
  notes?: string
  approvedAt?: string | number
  rejectedAt?: string | number
}