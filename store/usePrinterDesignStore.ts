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
  companyName: 'SK Briyani', showCompanyName: true, companyNameBold: true,
  location: '', showLocation: false,
  phoneNumber: '', showPhoneNumber: false,
  email: '', showEmail: false,
  gstNumber: '', showGstNumber: false,
  website: '', showWebsite: false,
  logoUrl: '', showLogo: false, logoSize: 50,
  customHeaderText: 'Welcome to our Store', showHeader: true,
  showBillId: true, showDate: true, showTime: true, showCashierName: false, showTableNumber: false, showOrderNumber: false,
  dateFormat: 'DD/MM/YYYY', timeFormat: '12-hour',
  showPaymentMethod: true, showAmountPaid: false, showChange: false, showTransactionId: false,
  showItemName: true, showSku: false, showQuantity: true, showUnit: false, showRate: true, showItemDiscount: false, showItemTax: false, showItemTotal: true,
  showSubtotal: true, showBillDiscount: false, showBillTax: false, showRoundOff: false, showGrandTotal: true,
  showFooter: true, footerText: '*****Thank You! Visit Again*****',
  paperSize: '80mm', fontSize: 12, textAlignment: 'center',
};

export const usePrinterDesignStore = create<PrinterDesignState>()(persist((set) => ({
  ...initialState, updateDesign: (updates) => set((state) => ({ ...state, ...updates })), resetDesign: () => set(initialState),
}), { 
  name: 'printer-design-storage',
  version: 1,
  migrate: (persistedState: any, version: number) => {
    if (version === 0) {
      // Force update the old state with the new desired initial state
      return { ...persistedState, ...initialState };
    }
    return persistedState;
  }
}));
