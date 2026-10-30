export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Salary',
  'Transport',
  'Maintenance',
  'Packaging',
  'Other',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface ExpenseRecord {
  id: string;
  companyId: string;
  branchId?: string | null;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  recordedByUserId: string;
  approvedByUserId?: string | null;
  supplierId?: string | null;
  attachmentUrl?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  createdAt: string;
}
