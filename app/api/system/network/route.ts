import { NextResponse } from 'next/server';
import os from 'os';
import { isLocalMySqlMode } from '@/lib/mysql';

export async function GET() {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
  }

  const port = process.env.PORT || '3000';
  const urls = addresses.map((ip) => `http://${ip}:${port}`);

  return NextResponse.json({
    addresses,
    port,
    urls,
    primaryUrl: urls[0] || `http://localhost:${port}`,
  });
}
