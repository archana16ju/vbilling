'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetNextInternalBarcode,
  mysqlCheckBarcodeUnique,
} from '@/lib/mysql-billing';

export async function getNextInternalBarcodeAction(): Promise<string> {
  if (isLocalMySqlMode()) {
    return await mysqlGetNextInternalBarcode();
  }
  // Fallback if not in mysql mode
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function checkBarcodeUniqueAction(
  barcode: string,
  excludeProductId?: string
): Promise<{ isUnique: boolean; conflictProduct?: { id: string; name: string } }> {
  if (isLocalMySqlMode()) {
    return await mysqlCheckBarcodeUnique(barcode, undefined, excludeProductId);
  }
  return { isUnique: true };
}
