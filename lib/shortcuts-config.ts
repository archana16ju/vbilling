export type ShortcutGroupId =
  | 'global'
  | 'sell_menu'
  | 'sell_receipt'
  | 'settlement'
  | 'screens'
  | 'kitchen';

export interface ShortcutDefinition {
  id: string;
  group: ShortcutGroupId;
  groupLabel: string;
  label: string;
  description: string;
  defaultKeys: string[];
}

export interface StoredShortcutConfig {
  showKeysOnButtons: boolean;
  // Map action ID -> { enabled: boolean, keys: string[] }
  actions: Record<string, { enabled: boolean; keys: string[] }>;
}

export const ALL_SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Anywhere – Global Shortcuts
  {
    id: 'global_terminal',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Sell / Terminal',
    description: 'Quickly navigate to the POS terminal selling screen',
    defaultKeys: ['F1'],
  },
  {
    id: 'global_tables',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Tables',
    description: 'Navigate to table layout and dining room view',
    defaultKeys: ['F2'],
  },
  {
    id: 'global_orders',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Orders',
    description: 'Navigate to sales history and live orders',
    defaultKeys: ['F3'],
  },
  {
    id: 'global_kitchen',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Kitchen',
    description: 'Navigate to kitchen display system (KDS)',
    defaultKeys: ['F4'],
  },
  {
    id: 'global_delivery',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Delivery',
    description: 'Navigate to active deliveries and rider dispatch',
    defaultKeys: ['F5'],
  },
  {
    id: 'global_menu',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Menu',
    description: 'Navigate to product catalog and menu management',
    defaultKeys: ['F6'],
  },
  {
    id: 'global_guests',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Guests',
    description: 'Navigate to customer and guest directory',
    defaultKeys: ['F7'],
  },
  {
    id: 'global_reports',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Reports',
    description: 'Navigate to business analytics and daily sales reports',
    defaultKeys: ['F8'],
  },
  {
    id: 'global_settings',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Go to Settings',
    description: 'Open software settings, printer, and company preferences',
    defaultKeys: ['Ctrl + ,'],
  },
  {
    id: 'global_help_screen',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Help for this screen',
    description: 'Display context help and quick instructions',
    defaultKeys: ['Alt + H'],
  },
  {
    id: 'global_show_shortcuts',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Show all shortcuts',
    description: 'Open the complete interactive keyboard shortcuts cheatsheet overlay',
    defaultKeys: ['?'],
  },
  {
    id: 'global_lock_counter',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Lock the counter',
    description: 'Instantly lock the counter screen for security',
    defaultKeys: ['Ctrl + L'],
  },
  {
    id: 'global_shift',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Open or close the shift',
    description: 'Open shift management to start or close current cashier shift',
    defaultKeys: ['Ctrl + Shift + S'],
  },
  {
    id: 'global_reload',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Reload this screen',
    description: 'Refresh current screen data without leaving application',
    defaultKeys: ['Ctrl + R'],
  },
  {
    id: 'global_close_dialog',
    group: 'global',
    groupLabel: 'Anywhere – Global',
    label: 'Close the dialog',
    description: 'Close the topmost open modal, dialog, or popup window',
    defaultKeys: ['Esc'],
  },

  // Sell – Product Menu
  {
    id: 'product_search',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Jump to product search',
    description: 'Focus barcode scanner and product search input',
    defaultKeys: ['/'],
  },
  {
    id: 'product_up',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Move up through products',
    description: 'Highlight previous product row or card',
    defaultKeys: ['↑'],
  },
  {
    id: 'product_down',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Move down through products',
    description: 'Highlight next product row or card',
    defaultKeys: ['↓'],
  },
  {
    id: 'product_left',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Move left',
    description: 'Move selection left in visual product grid',
    defaultKeys: ['←'],
  },
  {
    id: 'product_right',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Move right',
    description: 'Move selection right in visual product grid',
    defaultKeys: ['→'],
  },
  {
    id: 'product_add',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Add selected product to cart',
    description: 'Add currently highlighted product to cart',
    defaultKeys: ['Enter'],
  },
  {
    id: 'product_prev_category',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Previous category',
    description: 'Switch to previous product category tab',
    defaultKeys: ['Ctrl + ←'],
  },
  {
    id: 'product_next_category',
    group: 'sell_menu',
    groupLabel: 'Sell – Product Menu',
    label: 'Next category',
    description: 'Switch to next product category tab',
    defaultKeys: ['Ctrl + →'],
  },

  // Sell – Receipt / Cart
  {
    id: 'cart_send_kitchen',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Send to Kitchen',
    description: 'Fire current order KOT to kitchen printers/KDS without taking payment',
    defaultKeys: ['F9'],
  },
  {
    id: 'cart_bill_only',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Bill Only',
    description: 'Print uncollected bill for customer review before final payment',
    defaultKeys: ['F10'],
  },
  {
    id: 'cart_send_bill_settle',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Send, Bill and Settle',
    description: 'Send KOT to kitchen, print invoice, and trigger immediate payment',
    defaultKeys: ['F11'],
  },
  {
    id: 'cart_bill_settle',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Bill and Settle',
    description: 'Complete sale and settle payment immediately',
    defaultKeys: ['F12'],
  },
  {
    id: 'cart_prev_line',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Previous receipt line',
    description: 'Select the previous item line in the cart',
    defaultKeys: ['Ctrl + ↑'],
  },
  {
    id: 'cart_next_line',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Next receipt line',
    description: 'Select the next item line in the cart',
    defaultKeys: ['Ctrl + ↓'],
  },
  {
    id: 'cart_qty_increase',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Increase selected item quantity by 1',
    description: 'Add 1 to the quantity of the currently selected cart line item',
    defaultKeys: ['+', '='],
  },
  {
    id: 'cart_qty_decrease',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Decrease selected item quantity by 1',
    description: 'Subtract 1 from the quantity of the currently selected cart line item',
    defaultKeys: ['-'],
  },
  {
    id: 'cart_item_remove',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Remove selected item',
    description: 'Remove currently selected item from the receipt/cart',
    defaultKeys: ['Delete'],
  },
  {
    id: 'cart_apply_discount',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Apply discount',
    description: 'Open discount modal to enter percentage or flat discount',
    defaultKeys: ['Ctrl + D'],
  },
  {
    id: 'cart_guest_info',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Guest name and phone',
    description: 'Open modal to enter customer details and loyalty link',
    defaultKeys: ['Ctrl + G'],
  },
  {
    id: 'cart_order_note',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Add order note',
    description: 'Attach special preparation or delivery note to this order',
    defaultKeys: ['Ctrl + N'],
  },
  {
    id: 'cart_order_type',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Change order type',
    description: 'Cycle order type between Dine In, Takeaway, and Delivery',
    defaultKeys: ['Ctrl + T'],
  },
  {
    id: 'cart_choose_table',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Choose a table',
    description: 'Open dining table selector to assign order to a table',
    defaultKeys: ['Ctrl + M'],
  },
  {
    id: 'cart_hold_bill',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Hold this bill',
    description: 'Put current cart on temporary hold to serve next customer',
    defaultKeys: ['Ctrl + H'],
  },
  {
    id: 'cart_recall_bill',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Recall held bill',
    description: 'Open held bills list to restore or clear previously held carts',
    defaultKeys: ['Ctrl + Shift + H'],
  },
  {
    id: 'cart_meal_plan',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: "Serve today's meal plan",
    description: 'Quick-add configured daily combo or meal plan',
    defaultKeys: ['Ctrl + E'],
  },
  {
    id: 'cart_cash_drawer',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Open cash drawer',
    description: 'Send electronic pulse to trigger open connected cash drawer',
    defaultKeys: ['Ctrl + O'],
  },
  {
    id: 'cart_reprint_bill',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Reprint last bill',
    description: 'Reprint the most recently completed invoice receipt',
    defaultKeys: ['Ctrl + P'],
  },
  {
    id: 'cart_new_order',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Start a new order',
    description: 'Reset cart, table, and customer to begin a fresh transaction',
    defaultKeys: ['Ctrl + Shift + N'],
  },
  {
    id: 'cart_clear_receipt',
    group: 'sell_receipt',
    groupLabel: 'Sell – Receipt / Cart',
    label: 'Clear receipt',
    description: 'Empty all current items from cart',
    defaultKeys: ['Ctrl + Delete'],
  },

  // Settlement / Payment Shortcuts
  {
    id: 'pay_cash',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Select Cash',
    description: 'Switch active payment tender to Cash',
    defaultKeys: ['Alt + 1'],
  },
  {
    id: 'pay_upi',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Select UPI',
    description: 'Switch active payment tender to UPI QR code',
    defaultKeys: ['Alt + 2'],
  },
  {
    id: 'pay_card',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Select Card',
    description: 'Switch active payment tender to Debit/Credit Card EDC',
    defaultKeys: ['Alt + 3'],
  },
  {
    id: 'pay_later',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Select Pay Later',
    description: 'Record order to customer account ledger / pay later',
    defaultKeys: ['Alt + 4'],
  },
  {
    id: 'pay_exact',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Exact amount',
    description: 'Auto-fill exact bill total in cash tender input',
    defaultKeys: ['Ctrl + Enter'],
  },
  {
    id: 'pay_complete',
    group: 'settlement',
    groupLabel: 'Settlement / Payment',
    label: 'Complete payment',
    description: 'Finalize transaction and trigger receipt printing',
    defaultKeys: ['Enter'],
  },

  // Orders, Guests, Menu and Delivery
  {
    id: 'screen_search',
    group: 'screens',
    groupLabel: 'Orders, Guests, Menu & Delivery',
    label: 'Search this screen',
    description: 'Focus filter/search box on any listing screen',
    defaultKeys: ['Ctrl + F'],
  },
  {
    id: 'screen_prev_row',
    group: 'screens',
    groupLabel: 'Orders, Guests, Menu & Delivery',
    label: 'Previous row',
    description: 'Highlight previous row in table listings',
    defaultKeys: ['↑'],
  },
  {
    id: 'screen_next_row',
    group: 'screens',
    groupLabel: 'Orders, Guests, Menu & Delivery',
    label: 'Next row',
    description: 'Highlight next row in table listings',
    defaultKeys: ['↓'],
  },
  {
    id: 'screen_open_row',
    group: 'screens',
    groupLabel: 'Orders, Guests, Menu & Delivery',
    label: 'Open selected row',
    description: 'Open details or edit view for currently selected row',
    defaultKeys: ['Enter'],
  },
  {
    id: 'screen_reprint',
    group: 'screens',
    groupLabel: 'Orders, Guests, Menu & Delivery',
    label: 'Reprint selected bill',
    description: 'Reprint receipt for highlighted bill row',
    defaultKeys: ['Ctrl + P'],
  },

  // Kitchen
  {
    id: 'kitchen_toggle_status',
    group: 'kitchen',
    groupLabel: 'Kitchen Display',
    label: 'Start preparation or mark order as ready',
    description: 'Advance kitchen ticket state (Pending → Preparing → Ready)',
    defaultKeys: ['Space'],
  },
];

export function getDefaultStoredShortcutsConfig(): StoredShortcutConfig {
  const actions: Record<string, { enabled: boolean; keys: string[] }> = {};
  for (const def of ALL_SHORTCUT_DEFINITIONS) {
    actions[def.id] = {
      enabled: true,
      keys: [...def.defaultKeys],
    };
  }
  return {
    showKeysOnButtons: true,
    actions,
  };
}

/**
 * Normalizes keyboard event into a standardized string representation.
 */
export function normalizeEventToShortcutString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let rawKey = e.key;

  // Standalone modifier press returns empty
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(rawKey)) {
    return '';
  }

  // Symbol normalization
  if (rawKey === ' ') rawKey = 'Space';
  else if (rawKey === 'ArrowUp') rawKey = '↑';
  else if (rawKey === 'ArrowDown') rawKey = '↓';
  else if (rawKey === 'ArrowLeft') rawKey = '←';
  else if (rawKey === 'ArrowRight') rawKey = '→';
  else if (rawKey === 'Escape') rawKey = 'Esc';
  else if (rawKey.length === 1) {
    // If key is already a symbol with Shift (e.g. ? or +), don't duplicate Shift
    if (rawKey === '?' || rawKey === '+') {
      const shiftIdx = parts.indexOf('Shift');
      if (shiftIdx > -1) parts.splice(shiftIdx, 1);
    }
    rawKey = rawKey.toUpperCase();
  }

  parts.push(rawKey);
  return parts.join(' + ');
}

/**
 * Canonical comparison for two shortcut strings.
 */
export function areShortcutsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/control/g, 'ctrl')
      .replace(/escape/g, 'esc')
      .replace(/arrowup/g, '↑')
      .replace(/arrowdown/g, '↓')
      .replace(/arrowleft/g, '←')
      .replace(/arrowright/g, '→');

  const setA = new Set(norm(a).split('+'));
  const setB = new Set(norm(b).split('+'));
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * Tests whether a native KeyboardEvent matches a registered shortcut definition string.
 */
export function matchesKeyboardEvent(e: KeyboardEvent, shortcutPattern: string): boolean {
  if (!shortcutPattern) return false;
  const pressedStr = normalizeEventToShortcutString(e);
  if (!pressedStr) return false;

  if (areShortcutsEqual(pressedStr, shortcutPattern)) {
    return true;
  }

  // Handle direct single keys like '+' or '=' or '-'
  const trimmed = shortcutPattern.trim();
  if (trimmed === '+' && (e.key === '+' || e.key === '=')) {
    return !e.ctrlKey && !e.altKey;
  }
  if (trimmed === '=' && e.key === '=') {
    return !e.ctrlKey && !e.altKey;
  }
  if (trimmed === '-' && (e.key === '-' || e.key === 'Minus')) {
    return !e.ctrlKey && !e.altKey;
  }
  if (trimmed === '/' && e.key === '/') {
    return !e.ctrlKey && !e.altKey;
  }
  if (trimmed === '?' && e.key === '?') {
    return !e.ctrlKey && !e.altKey;
  }

  return false;
}

/**
 * Conflict detection: checks if a proposed shortcut is already used by another enabled action.
 */
export function findShortcutConflict(
  config: StoredShortcutConfig,
  targetActionId: string,
  proposedKey: string
): { conflictActionId: string; conflictActionLabel: string } | null {
  for (const def of ALL_SHORTCUT_DEFINITIONS) {
    if (def.id === targetActionId) continue;
    const actionState = config.actions[def.id];
    if (!actionState || !actionState.enabled) continue;

    for (const assignedKey of actionState.keys || []) {
      if (areShortcutsEqual(assignedKey, proposedKey)) {
        return {
          conflictActionId: def.id,
          conflictActionLabel: def.label,
        };
      }
    }
  }
  return null;
}
