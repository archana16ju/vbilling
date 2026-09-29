import { NextResponse } from 'next/server';
import { clearCache } from '@/lib/storage';

export async function POST() {
  try {
    await clearCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
