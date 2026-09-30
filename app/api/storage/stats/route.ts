import { NextResponse } from 'next/server';
import { getStorageStats } from '@/lib/storage';
import { getMongoClient } from '@/lib/mongodb';

export async function GET() {
  try {
    const stats = await getStorageStats();
    
    let isMongoConnected = false;
    try {
      const client = await getMongoClient();
      if (client) {
        await Promise.race([
          client.db('admin').command({ ping: 1 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);
        isMongoConnected = true;
      }
    } catch (e) {
      isMongoConnected = false;
    }

    return NextResponse.json({ ...stats, isMongoConnected });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
