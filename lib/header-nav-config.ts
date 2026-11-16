export interface HeaderNavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: string;
  visible: boolean;         // Master visibility toggle (false = hidden everywhere)
  showInHeader: boolean;    // true = Header / More dropdown, false = Sidebar
  order: number;            // Display order sequence
  moduleKey?: string | null; // Permission module key
}

export interface CompanyHeaderNavConfig {
  maxHeaderItems: number;   // Number of direct items shown in header before overflowing to "More" (3-8, default: 5)
  items: HeaderNavItemConfig[];
  updatedAt?: string;
}

/**
 * Standard master navigation definitions across the entire billing software.
 */
export const DEFAULT_HEADER_NAV_ITEMS: HeaderNavItemConfig[] = [
  // 5 Default Header Items (Matching Reference Design)
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'Home',
    visible: true,
    showInHeader: true,
    order: 1,
    moduleKey: null,
  },
  {
    id: 'terminal',
    label: 'POS',
    href: '/terminal',
    icon: 'ShoppingBag',
    visible: true,
    showInHeader: true,
    order: 2,
    moduleKey: 'terminal',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: 'BarChart3',
    visible: true,
    showInHeader: true,
    order: 3,
    moduleKey: 'reports',
  },
  {
    id: 'stocks',
    label: 'Stock',
    href: '/stocks',
    icon: 'Box',
    visible: true,
    showInHeader: true,
    order: 4,
    moduleKey: 'stocks',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
    visible: true,
    showInHeader: true,
    order: 5,
    moduleKey: 'settings',
  },

  // Secondary items defaulting to Sidebar
  {
    id: 'tables',
    label: 'Tables',
    href: '/tables',
    icon: 'LayoutGrid',
    visible: true,
    showInHeader: false,
    order: 6,
    moduleKey: 'tables',
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/assigned-orders',
    icon: 'ClipboardList',
    visible: true,
    showInHeader: false,
    order: 7,
    moduleKey: 'tables',
  },
  {
    id: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: 'List',
    visible: true,
    showInHeader: false,
    order: 8,
    moduleKey: 'sales_and_bills',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    href: '/kitchen',
    icon: 'Utensils',
    visible: true,
    showInHeader: false,
    order: 9,
    moduleKey: 'kitchen',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    href: '/delivery',
    icon: 'Truck',
    visible: true,
    showInHeader: false,
    order: 10,
    moduleKey: 'delivery',
  },
  {
    id: 'categories',
    label: 'Categories',
    href: '/categories',
    icon: 'Tags',
    visible: true,
    showInHeader: false,
    order: 11,
    moduleKey: 'categories',
  },
  {
    id: 'addons',
    label: 'Add-ons',
    href: '/add-ons',
    icon: 'Layers',
    visible: true,
    showInHeader: false,
    order: 12,
    moduleKey: 'products',
  },
  {
    id: 'promotions',
    label: 'Promotions',
    href: '/promotions',
    icon: 'BadgePercent',
    visible: true,
    showInHeader: false,
    order: 13,
    moduleKey: 'promotions',
  },
  {
    id: 'inventory',
    label: 'Products',
    href: '/products',
    icon: 'Package',
    visible: true,
    showInHeader: false,
    order: 14,
    moduleKey: 'products',
  },
  {
    id: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: 'User',
    visible: true,
    showInHeader: false,
    order: 15,
    moduleKey: 'customers',
  },
  {
    id: 'staff',
    label: 'Staff',
    href: '/staff',
    icon: 'CalendarCheck',
    visible: true,
    showInHeader: false,
    order: 16,
    moduleKey: 'staff',
  },
  {
    id: 'users',
    label: 'Users',
    href: '/users',
    icon: 'Users',
    visible: true,
    showInHeader: false,
    order: 17,
    moduleKey: 'users',
  },
  {
    id: 'companies',
    label: 'Companies',
    href: '/companies',
    icon: 'Building2',
    visible: true,
    showInHeader: false,
    order: 18,
    moduleKey: 'companies',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    href: '/announcements',
    icon: 'Megaphone',
    visible: true,
    showInHeader: false,
    order: 19,
    moduleKey: null,
  },
  {
    id: 'notification_rules',
    label: 'Notification Rules',
    href: '/notification-rules',
    icon: 'BellRing',
    visible: true,
    showInHeader: false,
    order: 20,
    moduleKey: 'settings',
  },
  {
    id: 'login_activity',
    label: 'Login Activity',
    href: '/login-activity',
    icon: 'ShieldAlert',
    visible: true,
    showInHeader: false,
    order: 21,
    moduleKey: null,
  },
];

export const DEFAULT_HEADER_NAV_CONFIG: CompanyHeaderNavConfig = {
  maxHeaderItems: 5,
  items: DEFAULT_HEADER_NAV_ITEMS,
};

/**
 * Normalizes and validates a raw config, merging any missing default items.
 */
export function normalizeHeaderNavConfig(raw: any): CompanyHeaderNavConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_HEADER_NAV_CONFIG;
  }

  const rawMax = Number(raw.maxHeaderItems);
  const maxHeaderItems = !isNaN(rawMax) && rawMax >= 2 && rawMax <= 10 ? rawMax : 5;
  const savedItems: any[] = Array.isArray(raw.items) ? raw.items : [];

  const itemMap = new Map<string, any>();
  for (const it of savedItems) {
    if (it && typeof it.id === 'string') {
      itemMap.set(it.id, it);
    }
  }

  // Automatic Migration: If existing config had 'inventory' set in header as old default, migrate to 'stocks'
  const savedInventory = itemMap.get('inventory');
  const savedStocks = itemMap.get('stocks');
  if (savedInventory && savedInventory.showInHeader && (!savedStocks || !savedStocks.showInHeader)) {
    itemMap.set('stocks', {
      ...(savedStocks || {}),
      id: 'stocks',
      label: 'Stock',
      href: '/stocks',
      icon: 'Box',
      showInHeader: true,
      order: savedInventory.order || 4,
      visible: true,
      moduleKey: 'stocks',
    });
    itemMap.set('inventory', {
      ...savedInventory,
      id: 'inventory',
      label: 'Products',
      href: '/products',
      icon: 'Package',
      showInHeader: false,
      order: 14,
      moduleKey: 'products',
    });
  }

  // Preserve saved settings while merging default definitions
  const merged: HeaderNavItemConfig[] = DEFAULT_HEADER_NAV_ITEMS.map((def, idx) => {
    const saved = itemMap.get(def.id);
    if (saved) {
      return {
        ...def,
        label: typeof saved.label === 'string' && saved.label.trim() ? saved.label.trim() : def.label,
        visible: typeof saved.visible === 'boolean' ? saved.visible : def.visible,
        showInHeader: typeof saved.showInHeader === 'boolean' ? saved.showInHeader : def.showInHeader,
        order: typeof saved.order === 'number' ? saved.order : idx + 1,
      };
    }
    return { ...def, order: idx + 1 };
  });

  // Sort ascending by order
  merged.sort((a, b) => a.order - b.order);

  return {
    maxHeaderItems,
    items: merged,
    updatedAt: raw.updatedAt,
  };
}
