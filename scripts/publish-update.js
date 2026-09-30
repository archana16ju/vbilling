const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI is not set.");
    process.exit(1);
  }

  // 1. Get current version from package.json
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  console.log(`Publishing release for version: ${currentVersion}`);

  const commitSha = process.env.GITHUB_SHA || require('child_process').execSync('git rev-parse HEAD').toString().trim();
  const commitMessage = process.env.COMMIT_MESSAGE || require('child_process').execSync('git log -1 --pretty=%B').toString().trim();
  console.log(`Commit SHA: ${commitSha}`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    // Connect to the specific database 'skbriyani' (or get from URI)
    const db = client.db('skbriyani'); 

    // 2. Check for duplicate release
    const existingRelease = await db.collection('releases').findOne({ version: currentVersion });
    if (existingRelease) {
      console.log(`Version ${currentVersion} is already published in MongoDB. Skipping to prevent duplicates.`);
      process.exit(0);
    }

    // 3. Find the compiled .exe
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.error("Error: dist directory not found. Did the build run?");
      process.exit(1);
    }

    const files = fs.readdirSync(distPath);
    const exeFile = files.find(f => f.endsWith('.exe') && f.includes('Setup') && f.includes(currentVersion));
    if (!exeFile) {
      console.error("Error: Could not find .exe file in dist directory.");
      process.exit(1);
    }

    const exePath = path.join(distPath, exeFile);
    console.log(`Found executable: ${exeFile}`);

    // Calculate SHA256
    const fileBuffer = fs.readFileSync(exePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const hex = hashSum.digest('hex');

    // 4. Upload to GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'updates' });
    const gridfsFilename = `billing-software-${currentVersion}-${commitSha.substring(0,7)}.exe`;
    
    console.log(`Uploading ${exeFile} to GridFS as ${gridfsFilename}...`);
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(exePath)
        .pipe(bucket.openUploadStream(gridfsFilename))
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`Upload complete.`);

    // 5. Insert Release Metadata
    const releaseData = {
      version: currentVersion,
      commit: commitSha,
      commitMessage: commitMessage,
      previousVersion: "unknown", // can be calculated if needed
      releaseDate: new Date().toISOString(),
      releaseNotes: [commitMessage],
      downloadUrl: `gridfs://${gridfsFilename}`,
      sha256: hex,
      mandatory: false
    };

    await db.collection('releases').insertOne(releaseData);
    console.log(`Successfully published release metadata to MongoDB for v${currentVersion}.`);

  } catch (error) {
    console.error("Error publishing update:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
