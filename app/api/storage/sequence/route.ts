
import { NextResponse } from 'next/server';
import { getLocalConfig, setLocalConfig } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');
    if (!dateStr) return NextResponse.json({ count: 0 });
    const val = await getLocalConfig('seq_' + dateStr);
    return NextResponse.json({ count: val ? parseInt(val, 10) : 0 });
  } catch (err) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { date, count } = await request.json();
    await setLocalConfig('seq_' + date, count.toString());
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

