/**
 * Pure TypeScript Barcode Generator (Code 128, EAN-13, UPC-A)
 * Zero external dependencies, produces crisp SVG markup for UI previews and thermal printing.
 */

// Code 128 Pattern Table (Patterns for values 0 to 106)
// Each value is an 11-bit pattern of widths [b1, s1, b2, s2, b3, s3]
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2], // 0-4
  [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3], // 5-9
  [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1], // 10-14
  [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2], // 15-19
  [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2], // 20-24
  [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1], // 25-29
  [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3], // 30-34
  [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3], // 35-39
  [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1], // 40-44
  [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1], // 45-49
  [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3], // 50-54
  [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1], // 55-59
  [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2], // 60-64
  [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4], // 65-69
  [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1], // 70-74
  [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1], // 75-79
  [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2], // 80-84
  [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1], // 85-89
  [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1], // 90-94
  [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1], // 95-99
  [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4], // 100-104
  [2,1,1,2,3,2], [2,3,3,1,1,1,2] // 105 (Start B), 106 (Stop: 7 elements)
];

const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;

// EAN-13 Digit Patterns [Left Odd (A), Left Even (B), Right (C)]
const EAN_L_A = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const EAN_L_B = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const EAN_R_C = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];

// EAN-13 First Digit Structure
const EAN_PARITY = [
  ['A','A','A','A','A','A'], // 0
  ['A','A','B','A','B','B'], // 1
  ['A','A','B','B','A','B'], // 2
  ['A','A','B','B','B','A'], // 3
  ['A','B','A','A','B','B'], // 4
  ['A','B','B','A','A','B'], // 5
  ['A','B','B','B','A','A'], // 6
  ['A','B','A','B','A','B'], // 7
  ['A','B','A','B','B','A'], // 8
  ['A','B','B','A','B','A']  // 9
];

export interface BarcodeRenderOptions {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPCA';
  width?: number; // module width in px (default 2)
  height?: number; // barcode height in px (default 60)
  displayValue?: boolean;
  fontSize?: number;
  textColor?: string;
  lineColor?: string;
  background?: string;
  quietZone?: number;
}

/**
 * Calculates check digit for 12-digit string to form valid EAN-13
 */
export function calculateEanCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits[i], 10) || 0;
    sum += i % 2 === 0 ? d : d * 3;
  }
  const rem = sum % 10;
  return rem === 0 ? 0 : 10 - rem;
}

/**
 * Validates barcode format and check digit
 */
export type BarcodeFormat = 'CODE128' | 'EAN13' | 'UPCA';

export function detectBarcodeFormat(value: string): BarcodeFormat {
  const clean = (value || '').trim();
  if (/^\d{13}$/.test(clean)) return 'EAN13';
  if (/^\d{12}$/.test(clean)) return 'UPCA';
  return 'CODE128';
}

export function validateEAN13(value: string): boolean {
  return validateBarcode(value, 'EAN13').valid;
}

export function validateUPCA(value: string): boolean {
  return validateBarcode(value, 'UPCA').valid;
}

export function validateCode128(value: string): boolean {
  return validateBarcode(value, 'CODE128').valid;
}

export function validateBarcode(value: string, format: 'CODE128' | 'EAN13' | 'UPCA'): { valid: boolean; error?: string } {
  const clean = (value || '').trim();
  if (!clean) return { valid: false, error: 'Barcode value cannot be empty' };

  if (format === 'EAN13') {
    if (!/^\d{12,13}$/.test(clean)) {
      return { valid: false, error: 'EAN-13 must contain 12 or 13 numeric digits' };
    }
    if (clean.length === 13) {
      const expectedCheck = calculateEanCheckDigit(clean.slice(0, 12));
      const actualCheck = parseInt(clean[12], 10);
      if (expectedCheck !== actualCheck) {
        return { valid: false, error: `Invalid EAN-13 check digit (expected ${expectedCheck}, got ${actualCheck})` };
      }
    }
    return { valid: true };
  }

  if (format === 'UPCA') {
    if (!/^\d{11,12}$/.test(clean)) {
      return { valid: false, error: 'UPC-A must contain 11 or 12 numeric digits' };
    }
    if (clean.length === 12) {
      const expectedCheck = calculateEanCheckDigit('0' + clean.slice(0, 11));
      const actualCheck = parseInt(clean[11], 10);
      if (expectedCheck !== actualCheck) {
        return { valid: false, error: `Invalid UPC-A check digit (expected ${expectedCheck}, got ${actualCheck})` };
      }
    }
    return { valid: true };
  }

  // Code 128 accepts standard ASCII printable chars
  if (format === 'CODE128') {
    if (!/^[\x20-\x7E]+$/.test(clean)) {
      return { valid: false, error: 'Code 128 supports standard alphanumeric and printable characters' };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Encodes text into Code 128 bit sequence (auto choosing optimal set)
 */
function encodeCode128(text: string): number[] {
  // If text is all digits of even length >= 4, use Code 128 C, else Set B
  const isPureDigits = /^\d+$/.test(text);
  const useSetC = isPureDigits && text.length % 2 === 0 && text.length >= 4;

  const codes: number[] = [];
  let checksum = 0;

  if (useSetC) {
    codes.push(CODE128_START_C);
    checksum = CODE128_START_C;
    for (let i = 0; i < text.length; i += 2) {
      const val = parseInt(text.substr(i, 2), 10);
      codes.push(val);
      checksum += val * (codes.length - 1);
    }
  } else {
    codes.push(CODE128_START_B);
    checksum = CODE128_START_B;
    for (let i = 0; i < text.length; i++) {
      const val = text.charCodeAt(i) - 32;
      codes.push(val);
      checksum += val * (codes.length - 1);
    }
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(CODE128_STOP);

  // Convert codes to bar/space widths
  const modules: number[] = [];
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c];
    if (pattern) {
      let isBar = true;
      for (const width of pattern) {
        for (let w = 0; w < width; w++) {
          modules.push(isBar ? 1 : 0);
        }
        isBar = !isBar;
      }
    }
  }

  return modules;
}

/**
 * Encodes 12 or 13 digit string into EAN-13 bit sequence
 */
function encodeEan13(rawDigits: string): number[] {
  let digits = rawDigits.trim();
  if (digits.length === 12) {
    digits += calculateEanCheckDigit(digits);
  }

  const firstDigit = parseInt(digits[0], 10);
  const parity = EAN_PARITY[firstDigit];
  const modules: number[] = [];

  // Start guard (101)
  modules.push(1, 0, 1);

  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const d = parseInt(digits[i], 10);
    const pattern = parity[i - 1] === 'A' ? EAN_L_A[d] : EAN_L_B[d];
    for (const bit of pattern) modules.push(bit === '1' ? 1 : 0);
  }

  // Center guard (01010)
  modules.push(0, 1, 0, 1, 0);

  // Right 6 digits
  for (let i = 7; i <= 12; i++) {
    const d = parseInt(digits[i], 10);
    const pattern = EAN_R_C[d];
    for (const bit of pattern) modules.push(bit === '1' ? 1 : 0);
  }

  // End guard (101)
  modules.push(1, 0, 1);

  return modules;
}

/**
 * Generates an SVG string representation of the requested barcode.
 */
export function generateBarcodeSvg(opts: BarcodeRenderOptions): string {
  const format = opts.format || 'CODE128';
  const cleanVal = (opts.value || '').trim();
  if (!cleanVal) return '';

  let modules: number[] = [];
  let displayString = cleanVal;

  try {
    if (format === 'EAN13') {
      let d = cleanVal;
      if (d.length === 12) d += calculateEanCheckDigit(d);
      modules = encodeEan13(d);
      displayString = d;
    } else if (format === 'UPCA') {
      let d = cleanVal;
      if (d.length === 11) d += calculateEanCheckDigit('0' + d);
      modules = encodeEan13('0' + d);
      displayString = d;
    } else {
      modules = encodeCode128(cleanVal);
    }
  } catch (err) {
    console.error('Barcode encoding error:', err);
    modules = encodeCode128(cleanVal);
  }

  const moduleWidth = opts.width || 2;
  const barHeight = opts.height || 55;
  const showText = opts.displayValue !== false;
  const fontSize = opts.fontSize || 13;
  const quietZone = opts.quietZone !== undefined ? opts.quietZone : 12;
  const lineColor = opts.lineColor || '#000000';
  const textColor = opts.textColor || '#000000';
  const background = opts.background || 'transparent';

  const barcodeWidth = modules.length * moduleWidth;
  const totalWidth = barcodeWidth + quietZone * 2;
  const textHeight = showText ? fontSize + 6 : 0;
  const totalHeight = barHeight + textHeight + 6;

  // Build rects for consecutive 1s
  const rects: string[] = [];
  let currentRun = 0;
  let runStart = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (currentRun === 0) runStart = i;
      currentRun++;
    } else {
      if (currentRun > 0) {
        const x = quietZone + runStart * moduleWidth;
        const w = currentRun * moduleWidth;
        rects.push(`<rect x="${x}" y="3" width="${w}" height="${barHeight}" fill="${lineColor}" />`);
        currentRun = 0;
      }
    }
  }
  if (currentRun > 0) {
    const x = quietZone + runStart * moduleWidth;
    const w = currentRun * moduleWidth;
    rects.push(`<rect x="${x}" y="3" width="${w}" height="${barHeight}" fill="${lineColor}" />`);
  }

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${barHeight + fontSize + 4}" font-family="monospace, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="1.5">${displayString}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background-color: ${background}; max-width: 100%; display: block; margin: 0 auto;">
    ${rects.join('\n    ')}
    ${textElement}
  </svg>`;
}

/**
 * Returns a data URL of the barcode SVG (safe for img tags and thermal prints)
 */
export function generateBarcodeDataUrl(opts: BarcodeRenderOptions): string {
  const svg = generateBarcodeSvg(opts);
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
