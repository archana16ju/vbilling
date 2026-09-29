const fs = require('fs');
const path = require('path');
const { MongoClient, GridFSBucket } = require('mongodb');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function publishUpdate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI in .env.local");
    process.exit(1);
  }

  // 1. Get package info
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;

  // 2. Get git info
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.warn("Could not read git commit. Ensure git is installed.");
  }

  // 3. Find the built .exe
  const distDir = path.join(__dirname, '../dist');
  const exePath = path.join(distDir, `billing-software Setup ${version}.exe`);

  if (!fs.existsSync(exePath)) {
    console.error(`Missing built .exe at ${exePath}`);
    console.error(`Please run 'npm run electron:build' first.`);
    process.exit(1);
  }

  console.log(`Publishing v${version} (Commit: ${commit})...`);
  console.log(`Found executable: ${exePath}`);
  const fileSize = fs.statSync(exePath).size / (1024 * 1024);
  console.log(`File size: ${fileSize.toFixed(2)} MB`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('billing_software');

    // 4. Upload exe to GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'updates' });
    const filename = `billing-software-v${version}.exe`;

    // Remove existing file with the same name if we are re-publishing
    const existingFiles = await db.collection('updates.files').find({ filename }).toArray();
    for (const file of existingFiles) {
      await bucket.delete(file._id);
      console.log(`Removed previous upload of ${filename}`);
    }

    console.log("Uploading .exe to MongoDB GridFS. This may take a moment...");
    const uploadStream = bucket.openUploadStream(filename);
    const readStream = fs.createReadStream(exePath);
    
    await new Promise((resolve, reject) => {
      readStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`Upload complete! GridFS ID: ${uploadStream.id}`);

    // 5. Update releases collection
    const releaseData = {
      version,
      commit,
      commitMessage: `Release v${version}`,
      releaseDate: new Date().toISOString(),
      releaseNotes: ["Automated update published via GridFS."],
      downloadUrl: `gridfs://${filename}`, // Custom protocol to signify GridFS download
      mandatory: false
    };

    await db.collection('releases').updateOne(
      { version: releaseData.version },
      { $set: releaseData },
      { upsert: true }
    );

    console.log(`Successfully published release document for v${version}.`);
    console.log(`Other computers will now detect and download this update automatically!`);

  } catch (err) {
    console.error("Error publishing update:", err);
  } finally {
    await client.close();
  }
}

publishUpdate();
