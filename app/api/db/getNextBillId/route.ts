import { NextResponse } from 'next/server';
import { getNextBillId } from '@/lib/actions/db';

export async function GET() {
  try {
    const data = await getNextBillId();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'System error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
