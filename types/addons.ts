export interface AddonItem {
  id: string;
  companyId?: string;
  name: string;
  image?: string | null;
  price: number;
  category?: string | null;
  tax?: number;
  trackStock: boolean;
  stock: number;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface AddonGroup {
  id: string;
  companyId?: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  selectionType: 'single' | 'multiple';
  isActive: boolean;
  itemIds?: string[];
  items?: AddonItem[];
  createdAt?: number;
  updatedAt?: number;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
  groupId: string;
  groupName: string;
  tax?: number;
}
