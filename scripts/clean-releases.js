require('dotenv').config({ path: './.env.local' });
const { MongoClient } = require('mongodb');

async function clean() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('billing_software');
  
  const result = await db.collection('releases').deleteMany({
    downloadUrl: { $not: /^gridfs:\/\// }
  });
  
  console.log(`Cleaned up ${result.deletedCount} old releases that were not using GridFS.`);
  await client.close();
}

clean();
