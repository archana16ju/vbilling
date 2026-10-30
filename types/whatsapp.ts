export type WhatsAppProvider = 'wa_me' | 'cloud_api' | 'gateway';
export type WhatsAppMessageMode = 'builder' | 'custom_template';
export type WhatsAppMessageFormat = 'paragraph' | 'short' | 'detailed';

export interface WhatsAppSettings {
  companyId?: string;
  isEnabled: boolean;
  provider: WhatsAppProvider;
  apiEndpoint?: string;
  apiKey?: string;
  phoneNumberId?: string;
  defaultCountryCode: string;
  businessPhone?: string;

  // Delivery Order Automation
  autoOpenDelivery: boolean;
  sendToRider: boolean;
  allowCashierEdit: boolean;

  // Message Structure & Formatting Mode
  messageMode: WhatsAppMessageMode;
  messageFormat: WhatsAppMessageFormat; // 'paragraph' (conversational greeting view), 'short', or 'detailed'

  // Paragraph Greeting View Configuration
  paragraphGreeting?: string;

  // Builder Options
  headerText: string;
  includeStoreName: boolean;
  includeOrderId: boolean;
  includeChannel: boolean;
  includeCustomerDetails: boolean;
  includeCustomerPhone: boolean;
  includeCustomerAddress: boolean;
  includeCustomerNotes: boolean;
  includeStaffDetails: boolean;
  includeItems: boolean;
  includeItemPrices: boolean;
  includeTotal: boolean;
  includePaymentMethod: boolean;
  includeTrackingLink: boolean;
  footerText: string;

  // Advanced Raw Custom Template
  customTemplate?: string;
}

export const PARAGRAPH_WHATSAPP_TEMPLATE = `Hi {customerName}, thank you for dining with us! Bill #{billNumber}, total ₹{total}. — {restaurantName}

*Assigned Staff:* {staffName} ({staffPhone})
*Status:* {status}
*Track Order:* {trackingLink}`;

export const SHORT_WHATSAPP_TEMPLATE = `*Delivery Order #{bill_id} Confirmed!*
*Assigned Staff:* {staff_name} ({staff_phone})
*Status:* {status_label}
*Track Order:* {tracking_link}`;

export const DETAILED_WHATSAPP_TEMPLATE = `*📦 Delivery Order Confirmed!*
*Store:* {brand}
*Order ID:* #{bill_id}
*Channel:* {channel}

*👤 Customer Details:*
• *Name:* {customer_name}
• *Phone:* {customer_phone}
• *Address:* {delivery_address}
• *Note:* {delivery_notes}

*🛵 Delivery Status:*
• *Status:* {status_label}
• *Assigned Staff:* {staff_name} ({staff_phone})

*🍽️ Items Ordered:*
{items}

*💵 Total Amount:* ₹{total} ({payment_method})

*📍 Track Your Order Live:*
{tracking_link}

{footer}`;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  isEnabled: true,
  provider: 'wa_me',
  apiEndpoint: '',
  apiKey: '',
  phoneNumberId: '',
  defaultCountryCode: '91',
  businessPhone: '',
  autoOpenDelivery: true,
  sendToRider: false,
  allowCashierEdit: true,
  messageMode: 'builder',
  messageFormat: 'paragraph',
  paragraphGreeting: 'Hi {customerName}, thank you for dining with us! Bill #{billNumber}, total ₹{total}. — {restaurantName}',
  headerText: 'Delivery Order #{bill_id} Confirmed!',
  includeStoreName: true,
  includeOrderId: true,
  includeChannel: false,
  includeCustomerDetails: true,
  includeCustomerPhone: false,
  includeCustomerAddress: false,
  includeCustomerNotes: false,
  includeStaffDetails: true,
  includeItems: false,
  includeItemPrices: false,
  includeTotal: true,
  includePaymentMethod: false,
  includeTrackingLink: true,
  footerText: '',
  customTemplate: PARAGRAPH_WHATSAPP_TEMPLATE,
};

