import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const options = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 5000
}

let client: MongoClient | null = null;

let globalWithMongo = global as typeof globalThis & {
  _mongoClient?: MongoClient
}

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!uri) {
    console.warn('MONGODB_URI is missing. App will run in offline/mock mode.')
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    if (!globalWithMongo._mongoClient) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClient = client;
    }
    client = globalWithMongo._mongoClient;
  } else {
    if (!client) {
      client = new MongoClient(uri, options);
    }
  }

  try {
    // By not using .connect().catch(), we allow the driver to auto-reconnect.
    // We just do a ping to verify.
    await client.db('admin').command({ ping: 1 });
    return client;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    // Do not permanently cache null. Return null for this specific check.
    return null;
  }
}
