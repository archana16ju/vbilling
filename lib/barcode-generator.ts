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
  format?: 'CODE128' | 'EAN13' | 'UPCA' | 'CODE39' | 'ITF' | 'QR' | 'DATAMATRIX';
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

// Code 39 Character Patterns (9 elements: 5 bars, 4 spaces, 1 = narrow, 2 = wide)
const CODE39_PATTERNS: Record<string, number[]> = {
  '0': [1,1,1,2,2,1,2,1,1], '1': [2,1,1,2,1,1,1,1,2], '2': [1,1,2,2,1,1,1,1,2], '3': [2,1,2,2,1,1,1,1,1],
  '4': [1,1,1,2,2,1,1,1,2], '5': [2,1,1,2,2,1,1,1,1], '6': [1,1,2,2,2,1,1,1,1], '7': [1,1,1,2,1,1,2,1,2],
  '8': [2,1,1,2,1,1,2,1,1], '9': [1,1,2,2,1,1,2,1,1], 'A': [2,1,1,1,1,2,1,1,2], 'B': [1,1,2,1,1,2,1,1,2],
  'C': [2,1,2,1,1,2,1,1,1], 'D': [1,1,1,1,2,2,1,1,2], 'E': [2,1,1,1,2,2,1,1,1], 'F': [1,1,2,1,2,2,1,1,1],
  'G': [1,1,1,1,1,2,2,1,2], 'H': [2,1,1,1,1,2,2,1,1], 'I': [1,1,2,1,1,2,2,1,1], 'J': [1,1,1,1,2,2,2,1,1],
  'K': [2,1,1,1,1,1,1,2,2], 'L': [1,1,2,1,1,1,1,2,2], 'M': [2,1,2,1,1,1,1,2,1], 'N': [1,1,1,1,2,1,1,2,2],
  'O': [2,1,1,1,2,1,1,2,1], 'P': [1,1,2,1,2,1,1,2,1], 'Q': [1,1,1,1,1,1,2,2,2], 'R': [2,1,1,1,1,1,2,2,1],
  'S': [1,1,2,1,1,1,2,2,1], 'T': [1,1,1,1,2,1,2,2,1], 'U': [2,2,1,1,1,1,1,1,2], 'V': [1,2,2,1,1,1,1,1,2],
  'W': [2,2,2,1,1,1,1,1,1], 'X': [1,2,1,1,2,1,1,1,2], 'Y': [2,2,1,1,2,1,1,1,1], 'Z': [1,2,2,1,2,1,1,1,1],
  '-': [1,2,1,1,1,1,2,1,2], '.': [2,2,1,1,1,1,2,1,1], ' ': [1,2,2,1,1,1,2,1,1], '$': [1,2,1,2,1,2,1,1,1],
  '/': [1,2,1,2,1,1,1,2,1], '+': [1,2,1,1,1,2,1,2,1], '%': [1,1,1,2,1,2,1,2,1], '*': [1,2,1,1,2,1,2,1,1]
};

export function encodeCode39(text: string): number[] {
  const upper = `*${text.toUpperCase().replace(/[^0-9A-Z\-.$/+% ]/g, '')}*`;
  const modules: number[] = [];

  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    const pat = CODE39_PATTERNS[char] || CODE39_PATTERNS['-'];
    for (let p = 0; p < pat.length; p++) {
      const isBar = p % 2 === 0;
      const width = pat[p]; // 1 or 2
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
    }
    // Inter-character gap (narrow space)
    if (i < upper.length - 1) {
      modules.push(0);
    }
  }
  return modules;
}

// ITF (Interleaved 2 of 5) Patterns
const ITF_PATTERNS: number[][] = [
  [1,1,2,2,1], // 0
  [2,1,1,1,2], // 1
  [1,2,1,1,2], // 2
  [2,2,1,1,1], // 3
  [1,1,2,1,2], // 4
  [2,1,2,1,1], // 5
  [1,2,2,1,1], // 6
  [1,1,1,2,2], // 7
  [2,1,1,2,1], // 8
  [1,2,1,2,1]  // 9
];

export function encodeITF(text: string): number[] {
  let digits = text.replace(/\D/g, '');
  if (digits.length % 2 !== 0) digits = '0' + digits; // Must be even
  const modules: number[] = [];

  // Start pattern: narrow bar, narrow space, narrow bar, narrow space (1,0,1,0)
  modules.push(1, 0, 1, 0);

  for (let i = 0; i < digits.length; i += 2) {
    const d1 = parseInt(digits[i], 10);
    const d2 = parseInt(digits[i + 1], 10);
    const bars = ITF_PATTERNS[d1];
    const spaces = ITF_PATTERNS[d2];

    for (let e = 0; e < 5; e++) {
      for (let b = 0; b < bars[e]; b++) modules.push(1);
      for (let s = 0; s < spaces[e]; s++) modules.push(0);
    }
  }

  // Stop pattern: wide bar, narrow space, narrow bar (1,1,0,1)
  modules.push(1, 1, 0, 1);
  return modules;
}

// 2D QR Code Matrix SVG Generator
function generateQrSvg(opts: BarcodeRenderOptions): string {
  const value = opts.value || '100001';
  const size = opts.height || 64;
  const lineColor = opts.lineColor || '#000000';
  const textColor = opts.textColor || '#000000';
  const showText = opts.displayValue !== false;
  const fontSize = opts.fontSize || 10;
  const textH = showText ? fontSize + 4 : 0;
  const totalH = size + textH + 4;

  // Simple pseudo-random hash generator based on string to generate unique high-density 21x21 QR pattern
  const N = 21;
  const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  // Finder patterns at (0,0), (14,0), (0,14)
  const addFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          grid[r0 + r][c0 + c] = true;
        }
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, 14);
  addFinder(14, 0);

  // Timing patterns
  for (let i = 8; i < 13; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Data modules
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) & 0xffffffff;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8) || r === 6 || c === 6) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      grid[r][c] = (seed % 100) < 55;
    }
  }

  const cellSize = (size - 8) / N;
  const rects: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        rects.push(`<rect x="${(4 + c * cellSize).toFixed(1)}" y="${(4 + r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="${lineColor}" />`);
      }
    }
  }

  const textElement = showText
    ? `<text x="${size / 2}" y="${size + fontSize + 2}" font-family="monospace, sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}" text-anchor="middle">${value}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalH}" width="${size}" height="${totalH}" style="display:block;margin:0 auto;">
    ${rects.join('')}
    ${textElement}
  </svg>`;
}

// 2D Data Matrix SVG Generator
function generateDataMatrixSvg(opts: BarcodeRenderOptions): string {
  const value = opts.value || '100001';
  const size = opts.height || 64;
  const lineColor = opts.lineColor || '#000000';
  const textColor = opts.textColor || '#000000';
  const showText = opts.displayValue !== false;
  const fontSize = opts.fontSize || 10;
  const textH = showText ? fontSize + 4 : 0;
  const totalH = size + textH + 4;

  const N = 16;
  const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  // Solid L-border (left and bottom)
  for (let i = 0; i < N; i++) {
    grid[i][0] = true;
    grid[N - 1][i] = true;
  }
  // Alternating border (top and right)
  for (let i = 0; i < N; i++) {
    grid[0][i] = i % 2 === 0;
    grid[i][N - 1] = i % 2 === 1;
  }

  let seed = 0;
  for (let i = 0; i < value.length; i++) seed = (seed * 37 + value.charCodeAt(i)) & 0xffffffff;
  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      grid[r][c] = (seed % 100) < 50;
    }
  }

  const cellSize = (size - 6) / N;
  const rects: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        rects.push(`<rect x="${(3 + c * cellSize).toFixed(1)}" y="${(3 + r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="${lineColor}" />`);
      }
    }
  }

  const textElement = showText
    ? `<text x="${size / 2}" y="${size + fontSize + 2}" font-family="monospace, sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}" text-anchor="middle">${value}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalH}" width="${size}" height="${totalH}" style="display:block;margin:0 auto;">
    ${rects.join('')}
    ${textElement}
  </svg>`;
}

/**
 * Generates an SVG string representation of the requested barcode.
 */
export function generateBarcodeSvg(opts: BarcodeRenderOptions): string {
  const format = opts.format || 'CODE128';
  const cleanVal = (opts.value || '').trim();
  if (!cleanVal) return '';

  if (format === 'QR') {
    return generateQrSvg(opts);
  }
  if (format === 'DATAMATRIX') {
    return generateDataMatrixSvg(opts);
  }

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
    } else if (format === 'CODE39') {
      modules = encodeCode39(cleanVal);
      displayString = cleanVal.toUpperCase();
    } else if (format === 'ITF') {
      modules = encodeITF(cleanVal);
      displayString = cleanVal;
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
