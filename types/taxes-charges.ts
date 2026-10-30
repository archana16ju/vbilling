export interface TaxItem {
  id: string;
  companyId?: string;
  name: string;
  rate: number;
  appliesTo: string;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface ChargeItem {
  id: string;
  companyId?: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: string[]; // e.g. ['Dine In'], ['Takeaway', 'Delivery']
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export const DEFAULT_TAXES: TaxItem[] = [
  {
    id: 'tax_cgst',
    name: 'CGST',
    rate: 2.5,
    appliesTo: 'Every bill',
    isActive: true,
  },
  {
    id: 'tax_sgst',
    name: 'SGST',
    rate: 2.5,
    appliesTo: 'Every bill',
    isActive: true,
  },
];

export const DEFAULT_CHARGES: ChargeItem[] = [
  {
    id: 'charge_service',
    name: 'Service charge',
    type: 'percentage',
    value: 5,
    appliesTo: ['Dine In'],
    isActive: true,
  },
  {
    id: 'charge_packing',
    name: 'Packing',
    type: 'fixed',
    value: 10,
    appliesTo: ['Takeaway', 'Delivery'],
    isActive: true,
  },
];
