require('dotenv').config();
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packageJson = require('./package.json');

async function publishUpdate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const version = packageJson.version;
    const exeName = `Billing Software Setup ${version}.exe`;
    const exePath = path.join(__dirname, 'dist', exeName);

    if (!fs.existsSync(exePath)) {
      console.error(`Error: Could not find ${exePath}`);
      console.error("Did you run 'npm run electron:build'?");
      process.exit(1);
    }

    console.log(`Uploading ${exeName} to GridFS updates bucket...`);
    const bucket = new GridFSBucket(db, { bucketName: 'updates' });
    
    // Hash the file
    const fileBuffer = fs.readFileSync(exePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const sha256 = hashSum.digest('hex');
    
    // Delete existing file with same name if exists
    const existingFiles = await db.collection('updates.files').find({ filename: exeName }).toArray();
    for (const f of existingFiles) {
      await bucket.delete(f._id);
    }
    
    // Upload new file
    await new Promise((resolve, reject) => {
      fs.createReadStream(exePath)
        .pipe(bucket.openUploadStream(exeName))
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`Upload complete. Creating release entry for ${version}...`);
    
    const releaseData = {
      version,
      commit: 'latest',
      commitMessage: 'Added hybrid online/offline architecture and syncing',
      previousVersion: '1.2.5',
      releaseDate: new Date().toISOString(),
      releaseNotes: [
        'Added background synchronization of SQLite data to live API',
        'Updated UI components to automatically use Live API when online',
        'Enabled global CORS headers for cross-origin local fetch',
        'Fallback HTTP download route for software updates'
      ],
      downloadUrl: `gridfs://${exeName}`,
      sha256,
      mandatory: true
    };

    await db.collection('releases').updateOne(
      { version: releaseData.version },
      { $set: releaseData },
      { upsert: true }
    );

    console.log("Successfully published new update version:", version);
  } catch (err) {
    console.error("Publish failed:", err);
  } finally {
    await client.close();
  }
}

publishUpdate();
