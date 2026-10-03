const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://admin:LdO0Ua5L2vjF15N4@cluster0.eihf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('billing');
    const sales = await db.collection('sales').find().sort({ timestamp: -1 }).limit(5).toArray();
    console.log('Recent Sales in MongoDB:');
    sales.forEach(s => console.log(s.id, s.total, s.paymentMethod));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
