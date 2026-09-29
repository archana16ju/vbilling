import { NextResponse } from 'next/server';
import { setStorageLocation } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const { path } = await request.json();
    await setStorageLocation(path);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
