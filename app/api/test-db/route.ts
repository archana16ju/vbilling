import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';

export async function GET() {
  if (isLocalMySqlMode()) {
    try {
      const pool = getMysqlPool();
      await pool.query('SELECT 1');
      return NextResponse.json({
        status: 'success',
        message: 'Successfully connected to Local MySQL (local_billing_db)!',
      }, { status: 200 });
    } catch (error: any) {
      console.error('Local MySQL connection error:', error.message);
      return NextResponse.json({
        status: 'error',
        message: 'Failed to connect to Local MySQL',
        error: error.message,
      }, { status: 500 });
    }
  }

  try {
    const { MongoClient } = await import('mongodb');
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is empty");
    
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();

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
