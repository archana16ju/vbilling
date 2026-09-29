require('dotenv').config({ path: './.env.local' });
const { MongoClient, GridFSBucket } = require('mongodb');

async function cleanGridFS() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('billing_software');
    const bucket = new GridFSBucket(db, { bucketName: 'updates' });
    
    // Find all files in GridFS
    const files = await db.collection('updates.files').find({}).toArray();
    console.log(`Found ${files.length} old .exe files in GridFS taking up space.`);
    
    // Delete them
    let deletedCount = 0;
    for (const file of files) {
      await bucket.delete(file._id);
      deletedCount++;
    }
    
    console.log(`Successfully deleted ${deletedCount} files to free up quota.`);
    
  } catch (err) {
    console.error("Failed to clean GridFS:", err);
  } finally {
    await client.close();
  }
}

cleanGridFS();
