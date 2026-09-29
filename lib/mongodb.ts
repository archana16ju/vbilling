import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const options = {
  serverSelectionTimeoutMS: 500, // Fail extremely fast if offline (instant fallback)
  connectTimeoutMS: 500,
  socketTimeoutMS: 1000
}

let client
let clientPromise: Promise<MongoClient | null>

if (!uri) {
  // If no URI is provided, resolve to null so the db.ts catch blocks trigger the mock data fallback
  console.warn('MONGODB_URI is missing. App will run in offline/mock mode.')
  clientPromise = Promise.resolve(null)
} else {
  if (process.env.NODE_ENV === 'development') {
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient | null>
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect().catch(err => {
        console.error("Failed to connect to MongoDB in dev:", err);
        return null;
      }) as Promise<MongoClient | null>;
    }
    clientPromise = globalWithMongo._mongoClientPromise as Promise<MongoClient | null>
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect().catch(err => {
      console.error("Failed to connect to MongoDB:", err);
      // Resolve to null so that getDb() can throw a controlled error instead of crashing the server
      return null;
    }) as Promise<MongoClient | null>;
  }
}

export default clientPromise
