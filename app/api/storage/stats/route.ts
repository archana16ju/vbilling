import { NextResponse } from 'next/server';
import { getStorageStats } from '@/lib/storage';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const stats = await getStorageStats();
    
    let isMongoConnected = false;
    try {
      const client = await clientPromise;
      if (client) {
        const pingPromise = client.db('admin').command({ ping: 1 });
        pingPromise.catch(() => {}); // Prevent unhandled rejection if it fails after timeout
        await Promise.race([
          pingPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        isMongoConnected = true;
      }
    } catch (e) {
      isMongoConnected = false;
    }

    return NextResponse.json({ ...stats, isMongoConnected });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', details: err.message || err.toString() }, { status: 500 });
  }
}
