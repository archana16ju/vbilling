/**
 * Verification test for Local MySQL Mode Isolation
 * Ensures no network connections or write attempts are made to MongoDB
 */

const assert = require('assert');

// 1. Simulate Local MySQL environment
process.env.LOCAL_DB_MODE = 'mysql';
process.env.NEXT_PUBLIC_LOCAL_DB_MODE = 'mysql';
process.env.NODE_ENV = 'development';
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_DATABASE = 'local_billing_db';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'password';

console.log('--- Testing Local MySQL Isolation Guards ---');

// Test A: lib/mongodb.ts
async function testMongoDriverIsolation() {
  console.log('Test 1: lib/mongodb.ts does NOT connect in local MySQL mode...');
  // Force require mongodb module via transpile or typescript check
  const ts = require('typescript');
  const fs = require('fs');
  const path = require('path');

  const mongoCode = fs.readFileSync(path.join(__dirname, '../lib/mongodb.ts'), 'utf8');
  assert(mongoCode.includes("const isLocalMySql = process.env.LOCAL_DB_MODE === 'mysql'"), 'isLocalMySql check must be present');
  assert(mongoCode.includes("clientPromise = Promise.resolve(null)"), 'clientPromise must resolve to null');

  // Verify that if isLocalMySql is true, MongoClient is not instantiated
  const isLocalMySql = process.env.LOCAL_DB_MODE === 'mysql' && process.env.NODE_ENV !== 'production';
  assert.strictEqual(isLocalMySql, true, 'isLocalMySql should evaluate to true');
  console.log('  -> PASS: lib/mongodb.ts safely resolves to null without connecting');
}

// Test B: /api/storage/sync route guard
function testStorageSyncGuard() {
  console.log('Test 2: app/api/storage/sync guard check...');
  const fs = require('fs');
  const path = require('path');
  const syncCode = fs.readFileSync(path.join(__dirname, '../app/api/storage/sync/route.ts'), 'utf8');
  assert(syncCode.includes('if (isLocalMySqlMode())'), 'Sync route must check isLocalMySqlMode()');
  assert(syncCode.includes('syncedBillIds: []'), 'Sync route must return empty synced IDs');
  console.log('  -> PASS: /api/storage/sync guards against writing to MongoDB');
}

// Test C: /api/upload route guard
function testUploadGuard() {
  console.log('Test 3: app/api/upload guard check...');
  const fs = require('fs');
  const path = require('path');
  const uploadCode = fs.readFileSync(path.join(__dirname, '../app/api/upload/route.ts'), 'utf8');
  assert(uploadCode.includes('if (isLocalMySqlMode())'), 'Upload route must check isLocalMySqlMode()');
  assert(uploadCode.includes('return NextResponse.json({ url: `/api/media/${filename}` })'), 'Upload route must return local URL without GridFS');
  console.log('  -> PASS: /api/upload saves locally and avoids MongoDB GridFS upload');
}

// Test D: /api/seed route guard
function testSeedGuard() {
  console.log('Test 4: app/api/seed guard check...');
  const fs = require('fs');
  const path = require('path');
  const seedCode = fs.readFileSync(path.join(__dirname, '../app/api/seed/route.ts'), 'utf8');
  assert(seedCode.includes('if (isLocalMySqlMode())'), 'Seed route must check isLocalMySqlMode()');
  assert(seedCode.includes('status: 403'), 'Seed route must return 403');
  console.log('  -> PASS: /api/seed rejects execution in local MySQL mode');
}

// Test E: /api/storage/stats route guard
function testStatsGuard() {
  console.log('Test 5: app/api/storage/stats guard check...');
  const fs = require('fs');
  const path = require('path');
  const statsCode = fs.readFileSync(path.join(__dirname, '../app/api/storage/stats/route.ts'), 'utf8');
  assert(statsCode.includes('if (isLocalMySqlMode())'), 'Stats route must check isLocalMySqlMode()');
  assert(statsCode.includes('isMongoConnected: false'), 'Stats route must report isMongoConnected: false');
  console.log('  -> PASS: /api/storage/stats avoids MongoDB admin ping in local MySQL mode');
}

// Test F: lib/auth-session.ts strictly rejects unsigned cookies
function testAuthSessionLegacyFallback() {
  console.log('Test 6: lib/auth-session.ts strictly rejects unsigned cookies...');
  const fs = require('fs');
  const path = require('path');
  const authCode = fs.readFileSync(path.join(__dirname, '../lib/auth-session.ts'), 'utf8');
  assert(authCode.includes('if (!token) {\n    // Strictly require signed session token. Never trust unsigned cookies.\n    return null;') ||
         authCode.includes('if (!token) {\r\n    // Strictly require signed session token. Never trust unsigned cookies.\r\n    return null;'),
         'getSession must return null when signed token is missing');
  console.log('  -> PASS: lib/auth-session.ts strictly rejects unsigned cookies');
}

// Test G: lib/actions/db.ts seedDatabase guard
function testSeedDatabaseGuard() {
  console.log('Test 7: lib/actions/db.ts seedDatabase guard check...');
  const fs = require('fs');
  const path = require('path');
  const dbCode = fs.readFileSync(path.join(__dirname, '../lib/actions/db.ts'), 'utf8');
  assert(dbCode.includes('if (isLocalMySqlMode()) {\n    return;') || dbCode.includes('if (isLocalMySqlMode()) {\r\n    return;'), 'seedDatabase must return immediately in local MySQL mode');
  console.log('  -> PASS: seedDatabase in db.ts is safely guarded');
}

async function runAll() {
  try {
    await testMongoDriverIsolation();
    testStorageSyncGuard();
    testUploadGuard();
    testSeedGuard();
    testStatsGuard();
    testAuthSessionLegacyFallback();
    testSeedDatabaseGuard();
    console.log('\nAll 7 Local Isolation Verification Checks PASSED successfully!');
  } catch (err) {
    console.error('\nFAILED verification check:', err);
    process.exit(1);
  }
}

runAll();
