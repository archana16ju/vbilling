import { NextResponse } from 'next/server';
import { getAllLocalBills } from '@/lib/storage';

export async function GET() {
  try {
    const bills = await getAllLocalBills();
    return NextResponse.json(bills);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch local bills' }, { status: 500 });
  }
}
