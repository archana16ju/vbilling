import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BarcodeFormatType, PrinterCommandLanguage } from '@/lib/barcode-printer-languages';

export type BarcodeConnectionType = 'system' | 'usb' | 'bluetooth' | 'network';

export interface BarcodePrinterState {
  // Connection & Hardware
  connectionType: BarcodeConnectionType;
  selectedPrinterName: string;
  printerLanguage: PrinterCommandLanguage;
  networkIp: string;
  networkPort: string;
  bluetoothDeviceName: string;
  bluetoothDeviceMac: string;
  usbDeviceName: string;

  // Label Geometry
  labelWidthMm: number;
  labelHeightMm: number;
  labelGapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  orientation: 'portrait' | 'landscape';

  // Hardware Calibration
  density: number; // 1-15
  speed: number;   // 1-6
  dpi: 203 | 300 | 600;

  // Barcode & Content Options
  defaultBarcodeFormat: BarcodeFormatType;
  showCompanyName: boolean;
  companyName: string;
  showProductName: boolean;
  showProductCode: boolean;
  showPrice: boolean;
  showBarcodeText: boolean;
  currencySymbol: string;

  // Actions
  updateSettings: (updates: Partial<Omit<BarcodePrinterState, 'updateSettings' | 'resetSettings'>>) => void;
  resetSettings: () => void;
}

export const INITIAL_BARCODE_PRINTER_STATE: Omit<BarcodePrinterState, 'updateSettings' | 'resetSettings'> = {
  connectionType: 'system',
  selectedPrinterName: 'Default Windows Driver / Spooler',
  printerLanguage: 'driver',
  networkIp: '192.168.1.200',
  networkPort: '9100',
  bluetoothDeviceName: '',
  bluetoothDeviceMac: '',
  usbDeviceName: 'Generic USB Barcode Printer',

  labelWidthMm: 50,
  labelHeightMm: 25,
  labelGapMm: 3,
  marginTopMm: 1,
  marginLeftMm: 1,
  orientation: 'portrait',

  density: 8,
  speed: 3,
  dpi: 203,

  defaultBarcodeFormat: 'CODE128',
  showCompanyName: true,
  companyName: '',
  showProductName: true,
  showProductCode: true,
  showPrice: true,
  showBarcodeText: true,
  currencySymbol: '₹',
};

export const useBarcodePrinterStore = create<BarcodePrinterState>()(
  persist(
    (set) => ({
      ...INITIAL_BARCODE_PRINTER_STATE,
      updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
      resetSettings: () => set(INITIAL_BARCODE_PRINTER_STATE),
    }),
    {
      name: 'barcode-label-printer-storage',
      version: 1,
    }
  )
);
