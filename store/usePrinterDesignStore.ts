import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PrinterDesignState {
  companyName: string; showCompanyName: boolean; companyNameBold: boolean;
  location: string; showLocation: boolean;
  phoneNumber: string; showPhoneNumber: boolean;
  email: string; showEmail: boolean;
  gstNumber: string; showGstNumber: boolean;
  website: string; showWebsite: boolean;
  logoUrl: string; showLogo: boolean; logoSize: number;
  customHeaderText: string; showHeader: boolean;
  showBillId: boolean; showDate: boolean; showTime: boolean; showCashierName: boolean; showTableNumber: boolean; showOrderNumber: boolean;
  dateFormat: 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY'; timeFormat: '12-hour' | '24-hour';
  showPaymentMethod: boolean; showAmountPaid: boolean; showChange: boolean; showTransactionId: boolean;
  showItemName: boolean; showSku: boolean; showQuantity: boolean; showUnit: boolean; showRate: boolean; showItemDiscount: boolean; showItemTax: boolean; showItemTotal: boolean;
  showSubtotal: boolean; showBillDiscount: boolean; showBillTax: boolean; showRoundOff: boolean; showGrandTotal: boolean;
  showFooter: boolean; footerText: string;
  paperSize: '58mm' | '80mm' | 'A4'; fontSize: number; textAlignment: 'left' | 'center' | 'right';
  updateDesign: (updates: Partial<Omit<PrinterDesignState, 'updateDesign' | 'resetDesign'>>) => void;
  resetDesign: () => void;
}

const initialState: Omit<PrinterDesignState, 'updateDesign' | 'resetDesign'> = {
  companyName: 'MY SHOP', showCompanyName: true, companyNameBold: true,
  location: '123 Main Street\nCity, State', showLocation: true,
  phoneNumber: '9876543210', showPhoneNumber: true,
  email: 'contact@myshop.com', showEmail: false,
  gstNumber: 'GSTIN123456789', showGstNumber: false,
  website: 'www.myshop.com', showWebsite: false,
  logoUrl: '', showLogo: false, logoSize: 50,
  customHeaderText: 'Welcome to our Store', showHeader: true,
  showBillId: true, showDate: true, showTime: true, showCashierName: true, showTableNumber: false, showOrderNumber: false,
  dateFormat: 'DD/MM/YYYY', timeFormat: '12-hour',
  showPaymentMethod: true, showAmountPaid: true, showChange: true, showTransactionId: false,
  showItemName: true, showSku: false, showQuantity: true, showUnit: false, showRate: true, showItemDiscount: false, showItemTax: false, showItemTotal: true,
  showSubtotal: true, showBillDiscount: true, showBillTax: true, showRoundOff: true, showGrandTotal: true,
  showFooter: true, footerText: 'Thank You!\nVisit Again',
  paperSize: '80mm', fontSize: 14, textAlignment: 'center',
};

export const usePrinterDesignStore = create<PrinterDesignState>()(persist((set) => ({
  ...initialState, updateDesign: (updates) => set((state) => ({ ...state, ...updates })), resetDesign: () => set(initialState),
}), { name: 'printer-design-storage' }));
