import { NextResponse } from 'next/server';
import { updateSalePayment } from '@/lib/actions/db';

export async function POST(request: Request) {
  try {
    const { billId, paymentMethod, cashReceived, changeReturned } = await request.json();
    if (!billId || !paymentMethod) {
      return NextResponse.json({ success: false, error: 'Missing billId or paymentMethod' }, { status: 400 });
    }
    const result = await updateSalePayment(billId, paymentMethod, cashReceived, changeReturned);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
