import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const options = {}

let client
let clientPromise: Promise<MongoClient | null>

if (!uri) {
  // If no URI is provided, resolve to null so the db.ts catch blocks trigger the mock data fallback
  console.warn('MONGODB_URI is missing. App will run in offline/mock mode.')
  clientPromise = Promise.resolve(null)
} else {
  if (process.env.NODE_ENV === 'development') {
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect()
    }
    clientPromise = globalWithMongo._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

export default clientPromise

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise
