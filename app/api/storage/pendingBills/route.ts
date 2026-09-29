import { NextResponse } from 'next/server';
import { getPendingBills, savePendingBill, deletePendingBill } from '@/lib/storage';

export async function GET() {
  try {
    const bills = await getPendingBills();
    return NextResponse.json(bills);
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const bill = await request.json();
    await savePendingBill(bill);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
    await deletePendingBill(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
