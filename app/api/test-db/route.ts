import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    if (!client) throw new Error('MongoDB is offline/disconnected');
    // Ping the database to ensure connection is working
    const db = client.db();
    await db.command({ ping: 1 });

    return NextResponse.json({ 
      status: 'success', 
      message: 'Successfully connected to MongoDB!' 
    }, { status: 200 });

  } catch (error: any) {
    console.error('MongoDB connection error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Failed to connect to MongoDB', 
      error: error.message 
    }, { status: 500 });
  }
}
