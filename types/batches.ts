export type BatchItemType = 'product' | 'raw_material';
export type BatchStatus = 'active' | 'near_expiry' | 'expired' | 'exhausted' | 'quarantined';
export type BatchTransactionType = 'inward' | 'sale_deduction' | 'waste_expired' | 'manual_adjustment' | 'return_restock' | 'quarantine';

export interface ProductBatch {
  id: string;
  companyId: string;
  itemType: BatchItemType;
  itemId: string;
  itemName?: string;
  itemSku?: string;
  batchNumber: string;
  manufacturingDate?: string | null; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  initialQuantity: number;
  currentQuantity: number;
  minStockLevel?: number;
  purchaseCost?: number;
  sellingPrice?: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
  purchaseOrderId?: string | null;
  status: BatchStatus;
  createdAt: number;
  updatedAt: number;
}

export interface BatchTransaction {
  id: string;
  companyId: string;
  batchId: string;
  batchNumber?: string;
  itemId?: string;
  itemName?: string;
  saleId?: string | null;
  transactionType: BatchTransactionType;
  quantity: number; // positive for inward/restock, negative for deduction
  quantityAfter: number;
  reason?: string | null;
  createdBy?: string | null;
  createdAt: number;
}

export interface BatchAllocationResult {
  allocated: {
    batchId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    sellingPrice?: number | null;
  }[];
  unallocatedQuantity: number;
  hasExpiredStock: boolean;
  hasNearExpiryStock: boolean;
}
