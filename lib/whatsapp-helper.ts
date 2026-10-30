import {
  WhatsAppSettings,
  DEFAULT_WHATSAPP_SETTINGS,
  SHORT_WHATSAPP_TEMPLATE,
  DETAILED_WHATSAPP_TEMPLATE,
} from '@/types/whatsapp';

export interface DeliveryMessageData {
  billId: string;
  companyName?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  deliveryPerson?: { name: string; phone?: string | null } | null;
  status: string;
  total?: number;
  paymentMethod?: string;
  items?: Array<{ name: string; quantity: number; price?: number }>;
  trackingToken?: string | null;
  platform?: string;
  orderSource?: string;
}

/**
 * Standardize phone number for WhatsApp wa.me links
 */
export function sanitizeWhatsAppPhone(phone: string, defaultCountryCode: string = '91'): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  const cleanCountry = defaultCountryCode.replace(/\D/g, '') || '91';

  // Standard 10-digit phone number (e.g., India)
  if (digits.length === 10) {
    return `${cleanCountry}${digits}`;
  }

  // Already prefixed with country code (e.g., 919876543210)
  if (digits.length > 10) {
    return digits;
  }

  return `${cleanCountry}${digits}`;
}

/**
 * Build the WhatsApp delivery message according to user-configured WhatsAppSettings
 */
export function formatWhatsAppDeliveryMessage(
  data: DeliveryMessageData,
  settings: Partial<WhatsAppSettings> = DEFAULT_WHATSAPP_SETTINGS,
  originUrl?: string
): string {
  const cfg: WhatsAppSettings = {
    ...DEFAULT_WHATSAPP_SETTINGS,
    ...settings,
  };

  const brand = data.companyName || 'Restaurant';
  const isAssigned = data.status?.toLowerCase() === 'assigned' && !!data.deliveryPerson?.name;
  const channel = data.platform || data.orderSource || 'Delivery';
  
  // Guarantee tracking link using token or billId with origin fallback
  const trackingIdentifier = data.trackingToken || data.billId || '';
  const defaultOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:3000';
  const origin = originUrl || defaultOrigin;
  const trackingLink = trackingIdentifier ? `${origin}/delivery/track/${trackingIdentifier}` : '';

  const statusLabel = isAssigned ? 'Assigned' : 'Unassigned';
  const staffName = isAssigned ? data.deliveryPerson!.name : 'Unassigned';
  const staffPhone = isAssigned && data.deliveryPerson?.phone ? data.deliveryPerson.phone : '';

  // Mode 1: Custom Template Mode
  if (cfg.messageMode === 'custom_template' && cfg.customTemplate?.trim()) {
    let tpl = cfg.customTemplate;

    // Build items string
    let itemsStr = '';
    if (data.items && data.items.length > 0) {
      itemsStr = data.items
        .map((item) => {
          const q = item.quantity || 1;
          const pricePart = item.price ? ` (₹${(Number(item.price) * q).toFixed(2)})` : '';
          return `• ${item.name} x ${q}${pricePart}`;
        })
        .join('\n');
    }

    // Handle staff placeholder gracefully (avoid 'Unassigned ()')
    const staffFull = isAssigned
      ? (staffPhone ? `${staffName} (${staffPhone})` : staffName)
      : 'Unassigned';

    tpl = tpl.replace('{staff_name} ({staff_phone})', staffFull);

    const custName = data.customerName || 'Valued Customer';
    const totalStr = data.total !== undefined ? Number(data.total).toFixed(2) : '0.00';

    const replacements: Record<string, string> = {
      '{brand}': brand,
      '{restaurantName}': brand,
      '{restaurant_name}': brand,
      '{bill_id}': data.billId || '',
      '{billNumber}': data.billId || '',
      '{bill_number}': data.billId || '',
      '{channel}': channel,
      '{customer_name}': custName,
      '{customerName}': custName,
      '{customer_phone}': data.customerPhone || '',
      '{customerPhone}': data.customerPhone || '',
      '{delivery_address}': data.deliveryAddress || '',
      '{deliveryAddress}': data.deliveryAddress || '',
      '{delivery_notes}': data.deliveryNotes || '',
      '{deliveryNotes}': data.deliveryNotes || '',
      '{status_label}': statusLabel,
      '{status}': statusLabel,
      '{staff_name}': staffName,
      '{staffName}': staffName,
      '{staff_phone}': staffPhone || 'Store Dispatch',
      '{staffPhone}': staffPhone || 'Store Dispatch',
      '{items}': itemsStr,
      '{total}': totalStr,
      '{payment_method}': data.paymentMethod || 'Cash',
      '{paymentMethod}': data.paymentMethod || 'Cash',
      '{tracking_link}': trackingLink,
      '{trackingLink}': trackingLink,
      '{footer}': cfg.footerText || '',
    };

    for (const [key, val] of Object.entries(replacements)) {
      tpl = tpl.split(key).join(val);
    }

    return tpl.trim();
  }

  const custName = data.customerName || 'Valued Customer';
  const totalStr = data.total !== undefined ? Number(data.total).toFixed(2) : '0.00';

  const commonReplacements: Record<string, string> = {
    '{brand}': brand,
    '{restaurantName}': brand,
    '{restaurant_name}': brand,
    '{bill_id}': data.billId || '',
    '{billNumber}': data.billId || '',
    '{bill_number}': data.billId || '',
    '{customer_name}': custName,
    '{customerName}': custName,
    '{total}': totalStr,
    '{staff_name}': staffName,
    '{staffName}': staffName,
    '{staff_phone}': staffPhone || 'Store Dispatch',
    '{staffPhone}': staffPhone || 'Store Dispatch',
    '{status_label}': statusLabel,
    '{status}': statusLabel,
    '{tracking_link}': trackingLink,
    '{trackingLink}': trackingLink,
  };

  // Mode 2A: Paragraph View (Conversational Greeting + Delivery Staff + Track Order link)
  if (cfg.messageFormat === 'paragraph') {
    const lines: string[] = [];

    // Greeting paragraph line
    const greetingTemplate = cfg.paragraphGreeting?.trim() ||
      'Hi {customerName}, thank you for dining with us! Bill #{billNumber}, total ₹{total}. — {restaurantName}';

    let greeting = greetingTemplate;
    for (const [key, val] of Object.entries(commonReplacements)) {
      greeting = greeting.split(key).join(val);
    }
    lines.push(greeting);

    // Delivery staff & status
    if (cfg.includeStaffDetails) {
      if (isAssigned) {
        const phoneSuffix = staffPhone ? ` (${staffPhone})` : '';
        lines.push(`*Assigned Staff:* ${staffName}${phoneSuffix}`);
      } else {
        lines.push(`*Assigned Staff:* Unassigned`);
      }
      lines.push(`*Status:* ${statusLabel}`);
    }

    if (cfg.includeCustomerAddress && data.deliveryAddress) {
      lines.push(`*Address:* ${data.deliveryAddress}`);
    }

    // Live order tracking link
    if (cfg.includeTrackingLink && trackingLink) {
      lines.push(`*Track Order:* ${trackingLink}`);
    }

    if (cfg.footerText?.trim()) {
      let footer = cfg.footerText.trim();
      for (const [key, val] of Object.entries(commonReplacements)) {
        footer = footer.split(key).join(val);
      }
      lines.push(footer);
    }

    return lines.join('\n').trim();
  }

  // Mode 2B: Short Format (Exact match of Terminal Delivery confirmation + tracking link)
  if (cfg.messageFormat === 'short') {
    const lines: string[] = [];

    // Line 1: Delivery Order #BILL-XXX Confirmed!
    const headerTitle = cfg.headerText?.includes('{bill_id}')
      ? cfg.headerText.replace('{bill_id}', data.billId || '')
      : (cfg.headerText?.trim() || `Delivery Order #${data.billId} Confirmed!`);
    lines.push(`*${headerTitle}*`);

    // Line 2: Assigned Staff: Suresh Patel (9876543211)
    if (cfg.includeStaffDetails) {
      if (isAssigned) {
        const phoneSuffix = staffPhone ? ` (${staffPhone})` : '';
        lines.push(`*Assigned Staff:* ${staffName}${phoneSuffix}`);
      } else {
        lines.push(`*Assigned Staff:* Unassigned`);
      }
      // Line 3: Status: Assigned
      lines.push(`*Status:* ${statusLabel}`);
    }

    // Optional lightweight details only if explicitly toggled on
    if (cfg.includeStoreName && brand) {
      lines.push(`*Store:* ${brand}`);
    }
    if (cfg.includeCustomerDetails && data.customerName) {
      const phoneSuffix = cfg.includeCustomerPhone && data.customerPhone ? ` (${data.customerPhone})` : '';
      lines.push(`*Customer:* ${data.customerName}${phoneSuffix}`);
    }
    if (cfg.includeCustomerAddress && data.deliveryAddress) {
      lines.push(`*Address:* ${data.deliveryAddress}`);
    }
    if (cfg.includeTotal && data.total !== undefined) {
      const paySuffix = cfg.includePaymentMethod && data.paymentMethod ? ` (${data.paymentMethod})` : '';
      lines.push(`*Total:* ₹${Number(data.total).toFixed(2)}${paySuffix}`);
    }

    // Line 4: Tracking order link (Included by default)
    if (cfg.includeTrackingLink && trackingLink) {
      lines.push(`*Track Order:* ${trackingLink}`);
    }

    if (cfg.footerText?.trim()) {
      lines.push(cfg.footerText.trim());
    }

    return lines.join('\n').trim();
  }

  // Mode 2B: Detailed Breakdown Mode
  const lines: string[] = [];

  // Header line
  if (cfg.headerText?.trim()) {
    const processedHeader = cfg.headerText.replace('{bill_id}', data.billId || '');
    lines.push(`*${processedHeader}*`);
  }

  // Store & Order ID
  if (cfg.includeStoreName && brand) {
    lines.push(`*Store:* ${brand}`);
  }
  if (cfg.includeOrderId && data.billId) {
    lines.push(`*Order ID:* #${data.billId}`);
  }
  if (cfg.includeChannel && channel && channel !== 'Delivery') {
    lines.push(`*Channel:* ${channel}`);
  }

  if (cfg.includeStoreName || cfg.includeOrderId || (cfg.includeChannel && channel !== 'Delivery')) {
    lines.push('');
  }

  // Customer Details
  if (cfg.includeCustomerDetails) {
    const custLines: string[] = [];
    if (data.customerName) custLines.push(`• *Name:* ${data.customerName}`);
    if (cfg.includeCustomerPhone && data.customerPhone) custLines.push(`• *Phone:* ${data.customerPhone}`);
    if (cfg.includeCustomerAddress && data.deliveryAddress) custLines.push(`• *Address:* ${data.deliveryAddress}`);
    if (cfg.includeCustomerNotes && data.deliveryNotes) custLines.push(`• *Note:* ${data.deliveryNotes}`);

    if (custLines.length > 0) {
      lines.push(`*👤 Customer Details:*`);
      lines.push(...custLines);
      lines.push('');
    }
  }

  // Delivery / Staff Details
  if (cfg.includeStaffDetails) {
    lines.push(`*🛵 Delivery Status:*`);
    if (isAssigned) {
      lines.push(`• *Status:* Assigned ✅`);
      lines.push(
        `• *Assigned Staff:* ${data.deliveryPerson!.name} (${data.deliveryPerson!.phone || 'Contact via Store'})`
      );
    } else {
      lines.push(`• *Status:* Saved / Rider Assignment in progress ⏳`);
    }
    lines.push('');
  }

  // Items List
  if (cfg.includeItems && data.items && data.items.length > 0) {
    lines.push(`*🍽️ Items Ordered:*`);
    data.items.forEach((item) => {
      const q = item.quantity || 1;
      const pricePart =
        cfg.includeItemPrices && item.price !== undefined
          ? ` (₹${(Number(item.price) * q).toFixed(2)})`
          : '';
      lines.push(`• ${item.name} x ${q}${pricePart}`);
    });
    lines.push('');
  }

  // Total Amount & Payment
  if (cfg.includeTotal && data.total !== undefined && data.total !== null) {
    const paymentPart = cfg.includePaymentMethod && data.paymentMethod ? ` (${data.paymentMethod})` : '';
    lines.push(`*💵 Total Amount:* ₹${Number(data.total).toFixed(2)}${paymentPart}`);
    lines.push('');
  }

  // Live Tracking Link
  if (cfg.includeTrackingLink && trackingLink) {
    lines.push(`*📍 Track Your Order Live:*`);
    lines.push(trackingLink);
    lines.push('');
  }

  // Custom Footer
  if (cfg.footerText?.trim()) {
    const processedFooter = cfg.footerText.split('{brand}').join(brand);
    lines.push(processedFooter);
  }

  return lines.join('\n').trim();
}

/**
 * Sample delivery data for live preview in Settings (matching user reference screenshot)
 */
export const SAMPLE_DELIVERY_DATA: DeliveryMessageData = {
  billId: 'BILL-291026-005',
  companyName: 'SK Briyani',
  customerName: 'Priya Sundaram',
  customerPhone: '9845012345',
  deliveryAddress: 'Flat 402, Green Valley Apartments, Anna Nagar, Chennai',
  deliveryNotes: 'Please ring the bell twice.',
  deliveryPerson: {
    name: 'Suresh Patel',
    phone: '9876543211',
  },
  status: 'assigned',
  total: 450.0,
  paymentMethod: 'Cash',
  items: [
    { name: 'Special Chicken Dum Briyani', quantity: 2, price: 180 },
    { name: 'Mutton Chukka', quantity: 1, price: 90 },
  ],
  trackingToken: 'tr_291026_005',
  platform: 'Delivery',
};

export interface WhatsAppMessageSegment {
  text: string;
  isBold?: boolean;
  isUrl?: boolean;
}

/**
 * Parses a single line of WhatsApp text into bold, link, and normal segments
 */
export function parseWhatsAppLine(line: string): WhatsAppMessageSegment[] {
  if (!line) return [];
  const regex = /(\*[^*]+\*|https?:\/\/[^\s]+|[^*]+)/g;
  const segments: WhatsAppMessageSegment[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const raw = match[0];
    if (raw.startsWith('*') && raw.endsWith('*') && raw.length > 2) {
      segments.push({ text: raw.slice(1, -1), isBold: true });
    } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      segments.push({ text: raw, isUrl: true });
    } else {
      segments.push({ text: raw });
    }
  }

  return segments;
}

