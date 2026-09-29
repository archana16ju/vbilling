import { NextResponse } from 'next/server';
import { getUpdateState, checkForUpdates, prepareBeforeUpdate, finalizeAfterUpdate } from '@/lib/updateSystem';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'check') {
      const state = await checkForUpdates();
      return NextResponse.json(state);
    } else if (action === 'status') {
      const state = await getUpdateState();
      return NextResponse.json(state);
    } else if (action === 'releases') {
      const { getAllReleases } = await import('@/lib/updateSystem');
      const releases = await getAllReleases();
      return NextResponse.json(releases);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (body.action === 'before') {
      const result = await prepareBeforeUpdate();
      return NextResponse.json(result);
    } else if (body.action === 'download') {
      const { downloadUpdate } = await import('@/lib/updateSystem');
      const result = await downloadUpdate(body.version, body.downloadUrl);
      return NextResponse.json(result);
    } else if (body.action === 'install') {
      const { installUpdate } = await import('@/lib/updateSystem');
      const result = await installUpdate(body.exePath);
      return NextResponse.json(result);
    } else if (body.action === 'after') {
      const result = await finalizeAfterUpdate();
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
