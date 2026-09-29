import { NextResponse } from 'next/server';
import { recordSale } from '@/lib/actions/db';

export async function POST(request: Request) {
  try {
    const sale = await request.json();
    const result = await recordSale(sale);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error("API Route Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'System error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
