import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/actions/db';
import clientPromise from '@/lib/mongodb';
import { PRODUCTS, CATEGORIES } from '@/lib/mock-data';

export async function GET() {
  try {
    const client = await clientPromise;
    if (!client) throw new Error('MongoDB is offline/disconnected');
    const db = client.db('billing_software');
    
    // Clear existing just in case (if user wants a fresh start)
    await db.collection('products').deleteMany({});
    await db.collection('categories').deleteMany({});
    
    // Seed new data
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, _id: p.id as any })));
    await db.collection('categories').insertMany(CATEGORIES.map(c => ({ ...c, _id: c.id as any })));

    return NextResponse.json({ message: 'Database successfully seeded with new menu!' });
  } catch (error: any) {
    console.error('Seeding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
