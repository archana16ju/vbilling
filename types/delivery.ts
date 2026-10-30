export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'out_for_delivery'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type AssignmentStatus = 'unassigned' | 'assigned';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

export type OrderSource = 'Terminal' | 'Zomato' | 'Swiggy' | string;

export interface DeliveryStatusHistoryEntry {
  status: DeliveryStatus;
  timestamp: number;
  note?: string;
  actor?: string;
}

export interface DeliveryPerson {
  id: string;
  companyId: string;
  name: string;
  employeeId: string;
  phone: string;
  isActive: boolean;
  availabilityStatus: AvailabilityStatus;
  assignedDeliveryCount: number;
  maxActiveDeliveries: number;
  lastAssignedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Delivery {
  id: string;
  companyId: string;
  billId: string;
  orderSource?: OrderSource;
  onlineOrderId?: string | null;
  trackingToken?: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryPersonId?: string | null;
  deliveryPersonName?: string | null;
  deliveryPersonPhone?: string | null;
  deliveryStatus: DeliveryStatus;
  assignmentStatus: AssignmentStatus;
  orderTime: number;
  assignedAt?: number | null;
  pickedUpAt?: number | null;
  deliveredAt?: number | null;
  deliveryNotes?: string | null;
  statusHistory?: DeliveryStatusHistoryEntry[] | null;
  latitude?: number | null;
  longitude?: number | null;
  locationUpdatedAt?: number | null;
  // Associated sale info for rich presentation
  items?: any[];
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OnlineOrderConfig {
  id: string;
  companyId: string;
  platform: 'zomato' | 'swiggy' | 'custom' | string;
  displayName: string;
  isEnabled: boolean;
  apiKey?: string | null;
  apiSecret?: string | null;
  storeId?: string | null;
  webhookSecret?: string | null;
  autoAccept: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
