import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetTaxesAndCharges,
  mysqlSaveTax,
  mysqlToggleTax,
  mysqlDeleteTax,
  mysqlSaveCharge,
  mysqlToggleCharge,
  mysqlDeleteCharge,
} from '@/lib/mysql-billing';
import { DEFAULT_TAXES, DEFAULT_CHARGES } from '@/types/taxes-charges';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId') || undefined;

    if (isLocalMySqlMode()) {
      const result = await mysqlGetTaxesAndCharges(companyId);
      return NextResponse.json(result);
    }

    return NextResponse.json({
      taxes: DEFAULT_TAXES,
      charges: DEFAULT_CHARGES,
    });
  } catch (err: any) {
    console.error('GET /api/settings/taxes-charges error:', err);
    return NextResponse.json({
      taxes: DEFAULT_TAXES,
      charges: DEFAULT_CHARGES,
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session && !isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, tax, charge, id, isActive, companyId } = body;

    if (!isLocalMySqlMode()) {
      // In non-MySQL mode, accept in-memory/echo
      return NextResponse.json({ success: true, message: 'Updated (offline/local mode)' });
    }

    if (action === 'save_tax' && tax) {
      const saved = await mysqlSaveTax(tax, companyId);
      return NextResponse.json({ success: true, tax: saved });
    }

    if (action === 'toggle_tax' && id !== undefined) {
      await mysqlToggleTax(id, Boolean(isActive), companyId);
      return NextResponse.json({ success: true, id, isActive });
    }

    if (action === 'delete_tax' && id) {
      await mysqlDeleteTax(id, companyId);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'save_charge' && charge) {
      const saved = await mysqlSaveCharge(charge, companyId);
      return NextResponse.json({ success: true, charge: saved });
    }

    if (action === 'toggle_charge' && id !== undefined) {
      await mysqlToggleCharge(id, Boolean(isActive), companyId);
      return NextResponse.json({ success: true, id, isActive });
    }

    if (action === 'delete_charge' && id) {
      await mysqlDeleteCharge(id, companyId);
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: 'Invalid action or payload' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/settings/taxes-charges error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update taxes/charges' }, { status: 500 });
  }
}
