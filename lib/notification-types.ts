export interface NotificationRule {
  id: string;
  companyId: string;
  name: string;
  eventType: string;
  isEnabled: boolean;
  roles: string[];
  userIds?: string[];
  priority: 'normal' | 'important' | 'urgent';
  channels: Array<'in_app' | 'sound' | 'email' | 'whatsapp'>;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  thresholdValue?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  companyId: string;
  eventType: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  entityType?: string | null;
  entityId?: string | null;
  targetRoles?: string[];
  targetUserId?: string | null;
  actionUrl?: string | null;
  dedupKey?: string | null;
  isRead: boolean;
  createdAt: string;
  soundEnabled?: boolean;
}

export const SUPPORTED_EVENT_TYPES = [
  { id: 'low_stock', name: 'Low Stock Alert', defaultRoles: ['manager', 'company_admin'], defaultPriority: 'urgent' },
  { id: 'new_delivery_order', name: 'New Delivery Order', defaultRoles: ['delivery_staff', 'manager'], defaultPriority: 'urgent' },
  { id: 'kitchen_delay', name: 'Kitchen Delay', defaultRoles: ['chef', 'manager'], defaultPriority: 'important' },
  { id: 'pending_approval', name: 'Pending Approval', defaultRoles: ['company_admin'], defaultPriority: 'important' },
  { id: 'cash_mismatch', name: 'Cash Mismatch', defaultRoles: ['manager', 'company_admin'], defaultPriority: 'urgent' },
  { id: 'new_announcement', name: 'New Announcement', defaultRoles: ['cashier', 'manager', 'chef', 'waiter', 'delivery_staff'], defaultPriority: 'normal' },
  { id: 'duplicate_warning', name: 'Duplicate Warning', defaultRoles: ['company_admin', 'manager'], defaultPriority: 'urgent' },
  { id: 'supplier_order_pending', name: 'Supplier Order Pending', defaultRoles: ['manager', 'company_admin'], defaultPriority: 'normal' },
];
