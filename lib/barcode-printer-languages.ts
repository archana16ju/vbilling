/**
 * Barcode Label Printer Command Languages & Hardware Abstraction Layer
 * Supports:
 * - TSPL / TSPL2 (TSC, Xprinter, Gprinter, HPRT, Rongta, etc.)
 * - ZPL II (Zebra, Citizen, Honeywell, Datamax, etc.)
 * - EPL2 (Eltron, Zebra legacy 2844)
 * - CPCL (Mobile / Portable label printers)
 * - Windows Driver / Vector SVG Spooling
 */

export type BarcodeFormatType =
  | 'CODE128'
  | 'EAN13'
  | 'UPCA'
  | 'CODE39'
  | 'ITF'
  | 'QR'
  | 'DATAMATRIX';

export type PrinterCommandLanguage = 'driver' | 'tspl' | 'zpl' | 'epl' | 'cpcl';

export interface BarcodeLabelConfig {
  widthMm: number;
  heightMm: number;
  gapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  density: number; // 1-15
  speed: number;   // 1-6
  dpi: 203 | 300 | 600;
  orientation: 'portrait' | 'landscape';
  format: BarcodeFormatType;
  showCompanyName: boolean;
  companyName: string;
  showProductName: boolean;
  showProductCode: boolean;
  showPrice: boolean;
  showBarcodeText: boolean;
  currencySymbol: string;
}

export interface BarcodePrintPayloadItem {
  name: string;
  code: string;
  barcode: string;
  price: number;
  copies: number;
}

// Convert mm to printer dots based on DPI
export function mmToDots(mm: number, dpi: 203 | 300 | 600 = 203): number {
  const dotsPerMm = dpi === 300 ? 11.81 : dpi === 600 ? 23.62 : 8.0;
  return Math.round(mm * dotsPerMm);
}

/**
 * Generate TSPL / TSPL2 Commands (TSC, Xprinter, Gprinter, Rongta, etc.)
 */
export function generateTSPL(
  config: BarcodeLabelConfig,
  items: BarcodePrintPayloadItem[]
): string {
  const commands: string[] = [];
  const dotsPerMm = config.dpi === 300 ? 11.81 : 8.0;
  const marginLeftDots = Math.round(config.marginLeftMm * dotsPerMm);
  const marginTopDots = Math.round(config.marginTopMm * dotsPerMm);

  for (const item of items) {
    const copies = Math.max(1, item.copies || 1);

    commands.push(`SIZE ${config.widthMm} mm, ${config.heightMm} mm`);
    commands.push(`GAP ${config.gapMm} mm, 0 mm`);
    commands.push(`DIRECTION ${config.orientation === 'landscape' ? 0 : 1}`);
    commands.push(`DENSITY ${Math.min(15, Math.max(1, config.density))}`);
    commands.push(`SPEED ${Math.min(6, Math.max(1, config.speed))}`);
    commands.push(`CLS`);

    let currentY = marginTopDots + 8;

    // 1. Company Name
    if (config.showCompanyName && config.companyName) {
      commands.push(
        `TEXT ${marginLeftDots + 16},${currentY},"3",0,1,1,"${config.companyName.toUpperCase().replace(/"/g, '')}"`
      );
      currentY += 28;
    }

    // 2. Product Name
    if (config.showProductName && item.name) {
      const cleanName = item.name.substring(0, 26).replace(/"/g, '');
      commands.push(`TEXT ${marginLeftDots + 16},${currentY},"2",0,1,1,"${cleanName}"`);
      currentY += 24;
    }

    // 3. Product Code / SKU
    if (config.showProductCode && (item.code || item.barcode)) {
      const cleanCode = (item.code || item.barcode).substring(0, 20).replace(/"/g, '');
      commands.push(`TEXT ${marginLeftDots + 16},${currentY},"1",0,1,1,"Code: ${cleanCode}"`);
      currentY += 20;
    }

    // 4. Barcode Graphic
    const barcodeVal = item.barcode || item.code || '100001';
    const barcodeHeight = Math.max(30, Math.min(70, Math.round(config.heightMm * dotsPerMm * 0.35)));

    if (config.format === 'QR') {
      commands.push(
        `QRCODE ${marginLeftDots + 30},${currentY},L,4,A,0,"${barcodeVal.replace(/"/g, '')}"`
      );
      currentY += 75;
    } else if (config.format === 'DATAMATRIX') {
      commands.push(
        `DMATRIX ${marginLeftDots + 30},${currentY},60,60,"${barcodeVal.replace(/"/g, '')}"`
      );
      currentY += 70;
    } else {
      // 1D Barcode (CODE128, EAN13, UPCA, CODE39, ITF)
      const tsplType =
        config.format === 'EAN13'
          ? 'EAN13'
          : config.format === 'UPCA'
          ? 'UPCA'
          : config.format === 'CODE39'
          ? '39'
          : config.format === 'ITF'
          ? 'ITF'
          : '128';

      const readableFlag = config.showBarcodeText ? 1 : 0;
      commands.push(
        `BARCODE ${marginLeftDots + 16},${currentY},"${tsplType}",${barcodeHeight},${readableFlag},0,2,2,"${barcodeVal.replace(/"/g, '')}"`
      );
      currentY += barcodeHeight + (config.showBarcodeText ? 24 : 10);
    }

    // 5. Price
    if (config.showPrice && item.price !== undefined) {
      commands.push(
        `TEXT ${marginLeftDots + 16},${currentY},"3",0,1,1,"${config.currencySymbol}${item.price.toFixed(2)}"`
      );
    }

    // Print command
    commands.push(`PRINT ${copies},1`);
    commands.push('');
  }

  return commands.join('\r\n');
}

/**
 * Generate ZPL II Commands (Zebra, Citizen, Honeywell, Datamax, etc.)
 */
export function generateZPL(
  config: BarcodeLabelConfig,
  items: BarcodePrintPayloadItem[]
): string {
  const commands: string[] = [];
  const dotsW = mmToDots(config.widthMm, config.dpi);
  const dotsH = mmToDots(config.heightMm, config.dpi);
  const dotsMarginLeft = mmToDots(config.marginLeftMm, config.dpi);
  const dotsMarginTop = mmToDots(config.marginTopMm, config.dpi);

  for (const item of items) {
    const copies = Math.max(1, item.copies || 1);

    commands.push('^XA');
    commands.push(`^PW${dotsW}`);
    commands.push(`^LL${dotsH}`);
    commands.push(`~SD${Math.min(30, Math.round(config.density * 2))}`); // Darkness
    commands.push(`^PR${config.speed}`); // Print speed

    let currentY = dotsMarginTop + 10;

    // 1. Company Name
    if (config.showCompanyName && config.companyName) {
      commands.push(`^FO${dotsMarginLeft + 20},${currentY}^A0N,22,22^FD${config.companyName.toUpperCase()}^FS`);
      currentY += 28;
    }

    // 2. Product Name
    if (config.showProductName && item.name) {
      commands.push(`^FO${dotsMarginLeft + 20},${currentY}^A0N,20,20^FD${item.name.substring(0, 28)}^FS`);
      currentY += 24;
    }

    // 3. Product Code / SKU
    if (config.showProductCode && (item.code || item.barcode)) {
      commands.push(`^FO${dotsMarginLeft + 20},${currentY}^A0N,16,16^FDCode: ${item.code || item.barcode}^FS`);
      currentY += 20;
    }

    // 4. Barcode
    const barcodeVal = item.barcode || item.code || '100001';
    const bcHeight = Math.max(30, Math.min(80, Math.round(dotsH * 0.35)));
    const showDigits = config.showBarcodeText ? 'Y' : 'N';

    if (config.format === 'QR') {
      commands.push(`^FO${dotsMarginLeft + 40},${currentY}^BQN,2,4^FDLA,${barcodeVal}^FS`);
      currentY += 80;
    } else if (config.format === 'DATAMATRIX') {
      commands.push(`^FO${dotsMarginLeft + 40},${currentY}^BXN,4,200^FD${barcodeVal}^FS`);
      currentY += 75;
    } else {
      let bcCmd = '^BCN';
      if (config.format === 'EAN13') bcCmd = '^BEN';
      else if (config.format === 'UPCA') bcCmd = '^BUN';
      else if (config.format === 'CODE39') bcCmd = '^B3N';
      else if (config.format === 'ITF') bcCmd = '^B2N';

      commands.push(`^FO${dotsMarginLeft + 20},${currentY}${bcCmd},${bcHeight},${showDigits},N,N^FD${barcodeVal}^FS`);
      currentY += bcHeight + (config.showBarcodeText ? 26 : 10);
    }

    // 5. Price
    if (config.showPrice && item.price !== undefined) {
      commands.push(
        `^FO${dotsMarginLeft + 20},${currentY}^A0N,24,24^FD${config.currencySymbol}${item.price.toFixed(2)}^FS`
      );
    }

    commands.push(`^PQ${copies}`);
    commands.push('^XZ');
  }

  return commands.join('\r\n');
}

/**
 * Generate EPL2 Commands (Eltron / Zebra 2844 legacy)
 */
export function generateEPL(
  config: BarcodeLabelConfig,
  items: BarcodePrintPayloadItem[]
): string {
  const commands: string[] = [];
  const dotsW = mmToDots(config.widthMm, config.dpi);
  const dotsH = mmToDots(config.heightMm, config.dpi);
  const dotsGap = mmToDots(config.gapMm, config.dpi);

  for (const item of items) {
    const copies = Math.max(1, item.copies || 1);

    commands.push('N'); // Clear image buffer
    commands.push(`q${dotsW}`); // Label width
    commands.push(`Q${dotsH},${dotsGap}`); // Label height and gap
    commands.push(`D${Math.min(15, Math.max(1, config.density))}`); // Density
    commands.push(`S${Math.min(6, Math.max(1, config.speed))}`); // Speed

    let currentY = 16;

    if (config.showCompanyName && config.companyName) {
      commands.push(`A20,${currentY},0,3,1,1,N,"${config.companyName.toUpperCase().replace(/"/g, '')}"`);
      currentY += 28;
    }

    if (config.showProductName && item.name) {
      commands.push(`A20,${currentY},0,2,1,1,N,"${item.name.substring(0, 26).replace(/"/g, '')}"`);
      currentY += 24;
    }

    if (config.showProductCode && (item.code || item.barcode)) {
      commands.push(`A20,${currentY},0,1,1,1,N,"Code: ${(item.code || item.barcode).replace(/"/g, '')}"`);
      currentY += 20;
    }

    const barcodeVal = item.barcode || item.code || '100001';
    const bcHeight = Math.max(25, Math.min(65, Math.round(dotsH * 0.35)));

    if (config.format === 'QR') {
      commands.push(`b20,${currentY},Q,m2,s4,"${barcodeVal.replace(/"/g, '')}"`);
      currentY += 75;
    } else {
      const eplType =
        config.format === 'EAN13'
          ? 'E30'
          : config.format === 'UPCA'
          ? 'UA0'
          : config.format === 'CODE39'
          ? '3'
          : '1'; // Code 128

      commands.push(
        `B20,${currentY},0,${eplType},2,2,${bcHeight},${config.showBarcodeText ? 'B' : 'N'},"${barcodeVal.replace(/"/g, '')}"`
      );
      currentY += bcHeight + (config.showBarcodeText ? 24 : 10);
    }

    if (config.showPrice && item.price !== undefined) {
      commands.push(`A20,${currentY},0,3,1,1,N,"${config.currencySymbol}${item.price.toFixed(2)}"`);
    }

    commands.push(`P${copies}`);
  }

  return commands.join('\r\n');
}

/**
 * Generate CPCL Commands (Mobile / Bluetooth portable printers)
 */
export function generateCPCL(
  config: BarcodeLabelConfig,
  items: BarcodePrintPayloadItem[]
): string {
  const commands: string[] = [];
  const dotsW = mmToDots(config.widthMm, config.dpi);
  const dotsH = mmToDots(config.heightMm, config.dpi);

  for (const item of items) {
    const copies = Math.max(1, item.copies || 1);

    commands.push(`! 0 ${config.dpi} ${config.dpi} ${dotsH} ${copies}`);
    commands.push(`PAGE-WIDTH ${dotsW}`);
    commands.push(`TONE ${Math.min(15, Math.max(1, config.density))}`);
    commands.push(`SPEED ${Math.min(6, Math.max(1, config.speed))}`);

    let currentY = 16;

    if (config.showCompanyName && config.companyName) {
      commands.push(`TEXT 4 0 20 ${currentY} ${config.companyName.toUpperCase()}`);
      currentY += 28;
    }

    if (config.showProductName && item.name) {
      commands.push(`TEXT 7 0 20 ${currentY} ${item.name.substring(0, 26)}`);
      currentY += 24;
    }

    if (config.showProductCode && (item.code || item.barcode)) {
      commands.push(`TEXT 7 0 20 ${currentY} Code: ${item.code || item.barcode}`);
      currentY += 20;
    }

    const barcodeVal = item.barcode || item.code || '100001';
    const bcHeight = Math.max(25, Math.min(65, Math.round(dotsH * 0.35)));

    if (config.format === 'QR') {
      commands.push(`B QR 20 ${currentY} M 2 U 4`);
      commands.push(`MA,${barcodeVal}`);
      commands.push('ENDQR');
      currentY += 75;
    } else {
      const cpclType =
        config.format === 'EAN13'
          ? 'EAN13'
          : config.format === 'UPCA'
          ? 'UPCA'
          : config.format === 'CODE39'
          ? '39'
          : '128';

      commands.push(`BARCODE ${cpclType} 1 1 ${bcHeight} 20 ${currentY} ${barcodeVal}`);
      currentY += bcHeight + 10;
      if (config.showBarcodeText) {
        commands.push(`TEXT 7 0 20 ${currentY} ${barcodeVal}`);
        currentY += 16;
      }
    }

    if (config.showPrice && item.price !== undefined) {
      commands.push(`TEXT 4 0 20 ${currentY} ${config.currencySymbol}${item.price.toFixed(2)}`);
    }

    commands.push('FORM');
    commands.push('PRINT');
  }

  return commands.join('\r\n');
}

/**
 * Universal dispatcher
 */
export function generateRawCommands(
  language: PrinterCommandLanguage,
  config: BarcodeLabelConfig,
  items: BarcodePrintPayloadItem[]
): string {
  switch (language) {
    case 'tspl':
      return generateTSPL(config, items);
    case 'zpl':
      return generateZPL(config, items);
    case 'epl':
      return generateEPL(config, items);
    case 'cpcl':
      return generateCPCL(config, items);
    default:
      return generateTSPL(config, items);
  }
}
