import { promises as fs } from 'fs';
import path from 'path';
import fsSync from 'fs';
import { exec } from 'child_process';
import { getStoragePaths, getPendingOfflineBillsCount, verifyOfflineBillsTable } from './storage';
let CURRENT_VERSION = '0.1.0';
try {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fsSync.existsSync(pkgPath)) {
    const pkg = JSON.parse(fsSync.readFileSync(pkgPath, 'utf8'));
    CURRENT_VERSION = pkg.version;
  }
} catch (e) {
  console.warn("Could not read package.json version, using fallback 0.1.0");
}

export { CURRENT_VERSION };

export interface UpdateMetadata {
  version: string;
  commit: string;
  commitMessage: string;
  previousVersion: string;
  releaseDate: string;
  releaseNotes: string[];
  downloadUrl: string;
  sha256: string;
  mandatory: boolean;
}

export interface UpdateState {
  status: 'IDLE' | 'CHECKING' | 'UPDATE_AVAILABLE' | 'PREPARING' | 'READY_TO_UPDATE' | 'DOWNLOADING' | 'VERIFYING' | 'INSTALLING' | 'FINALIZING' | 'SUCCESS' | 'FAILED' | 'ROLLBACK_AVAILABLE';
  latestRelease?: UpdateMetadata;
  lastChecked?: number;
  message?: string;
  currentCommit?: string;
  currentVersion?: string;
  history: Array<{
    version: string;
    commit?: string;
    date: string;
    status: string;
  }>;
}

const UPDATE_STATE_FILE = 'update_state.json';

export async function getUpdateState(): Promise<UpdateState> {
  const paths = await getStoragePaths();
  const statePath = path.join(paths.base, UPDATE_STATE_FILE);
  
  if (!fsSync.existsSync(statePath)) {
    const initialState: UpdateState = {
      status: 'IDLE',
      currentCommit: 'unknown',
      currentVersion: CURRENT_VERSION,
      history: [{ version: CURRENT_VERSION, commit: 'unknown', date: new Date().toISOString(), status: 'Installed' }]
    };
    await fs.writeFile(statePath, JSON.stringify(initialState, null, 2));
    return initialState;
  }

  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(raw);
    state.currentVersion = CURRENT_VERSION;
    return state;
  } catch (parseError) {
    console.error("Corrupted update_state.json, resetting...", parseError);
    const initialState: UpdateState = {
      status: 'IDLE',
      currentCommit: 'unknown',
      currentVersion: CURRENT_VERSION,
      history: [{ version: CURRENT_VERSION, commit: 'unknown', date: new Date().toISOString(), status: 'Installed' }]
    };
    await fs.writeFile(statePath, JSON.stringify(initialState, null, 2));
    return initialState;
  }
}

export async function saveUpdateState(state: Partial<UpdateState>) {
  const currentState = await getUpdateState();
  const newState = { ...currentState, ...state };
  const paths = await getStoragePaths();
  const statePath = path.join(paths.base, UPDATE_STATE_FILE);
  await fs.writeFile(statePath, JSON.stringify(newState, null, 2));
  return newState;
}

import { getDb } from './actions/db';

export async function checkForUpdates(): Promise<UpdateState> {
  await saveUpdateState({ status: 'CHECKING' });
  
  try {
    let latestReleaseDoc: any[] = [];
    
    try {
      const db = await getDb();
      latestReleaseDoc = await db.collection('releases').find({}).sort({ releaseDate: -1 }).limit(1).toArray();
    } catch (e) {
      // If MongoDB is offline, fetch from live API
      const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
      if (liveApiUrl) {
        try {
          const res = await fetch(`${liveApiUrl}/api/update?action=releases`);
          if (res.ok) {
            const releases = await res.json();
            if (releases && releases.length > 0) {
              latestReleaseDoc = [releases[0]];
            }
          }
        } catch (fetchErr) {
          throw new Error('Update server (Live API) is unreachable. You are offline.');
        }
      } else {
        throw new Error('Update server (Database) is unreachable. You are offline.');
      }
    }

    if (latestReleaseDoc.length === 0) {
      return await saveUpdateState({
        status: 'IDLE',
        message: 'No updates published yet.',
        lastChecked: Date.now()
      });
    }

    const latestRelease = latestReleaseDoc[0] as unknown as UpdateMetadata;
    
    // Compare versions (simple string compare or semver logic)
    // If we have 1.0.1 in DB and 1.0.0 locally, it's an update.
    if (latestRelease.version !== CURRENT_VERSION) {
      return await saveUpdateState({
        status: 'UPDATE_AVAILABLE',
        latestRelease,
        message: `New version ${latestRelease.version} is available!`,
        lastChecked: Date.now()
      });
    } else {
      return await saveUpdateState({
        status: 'IDLE',
        message: 'You are on the latest version.',
        lastChecked: Date.now()
      });
    }
  } catch (e: any) {
    console.error("Update check failed:", e);
    return await saveUpdateState({
      status: 'FAILED',
      message: e.message || 'Offline / unable to check.',
      lastChecked: Date.now()
    });
  }
}

export async function getAllReleases(): Promise<UpdateMetadata[]> {
  try {
    const db = await getDb();
    const releases = await db.collection('releases').find({}).sort({ releaseDate: -1 }).toArray();
    return releases as unknown as UpdateMetadata[];
  } catch (e) {
    const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
    if (liveApiUrl) {
      try {
        const res = await fetch(`${liveApiUrl}/api/update?action=releases`);
        if (res.ok) {
          return await res.json() as UpdateMetadata[];
        }
      } catch (fetchErr) {}
    }
    console.error("Failed to fetch releases from DB or Live API", e);
    return [];
  }
}

export async function prepareBeforeUpdate(): Promise<{ success: boolean; message: string }> {
  try {
    await saveUpdateState({ status: 'PREPARING', message: 'Preparing update...' });
    
    // 1. Check SQLite
    const paths = await getStoragePaths();
    if (!fsSync.existsSync(paths.database)) {
      throw new Error("SQLite database not found.");
    }

    // 2. Backup SQLite DB
    const backupDbPath = path.join(paths.base, 'database', `local_storage_backup_${CURRENT_VERSION}_${Date.now()}.db`);
    await fs.copyFile(paths.database, backupDbPath);

    // 3. Verify Offline Bills (ensure table exists and is accessible)
    const pendingCount = await getPendingOfflineBillsCount();
    
    // 4. Verify Local Images
    if (!fsSync.existsSync(paths.productImages)) {
      await fs.mkdir(paths.productImages, { recursive: true });
    }

    await saveUpdateState({ 
      status: 'READY_TO_UPDATE', 
      message: `Ready for update. Database backed up. Pending offline bills safe (${pendingCount}).` 
    });

    return { success: true, message: 'Ready to update' };
  } catch (e: any) {
    await saveUpdateState({ status: 'FAILED', message: `Preparation failed: ${e.message}` });
    return { success: false, message: e.message };
  }
}

export async function finalizeAfterUpdate(): Promise<{ success: boolean; message: string }> {
  try {
    await saveUpdateState({ status: 'FINALIZING', message: 'Completing update...' });
    
    const paths = await getStoragePaths();
    
    // 1. Run migrations if needed (mocked idempotently here)
    // db.exec(`ALTER TABLE ...`)

    // 2. Verify database integrity
    const hasOfflineBills = await verifyOfflineBillsTable();
    if (!hasOfflineBills) {
      throw new Error("Critical table offline_bills missing after update!");
    }

    // 3. Append to history
    const state = await getUpdateState();
    const history = [...state.history];
    history.unshift({
      version: CURRENT_VERSION,
      date: new Date().toISOString(),
      status: 'Successful'
    });

    await saveUpdateState({ 
      status: 'SUCCESS', 
      message: 'Update completed successfully.',
      history 
    });

    return { success: true, message: 'Update finalized successfully' };
  } catch (e: any) {
    await saveUpdateState({ status: 'FAILED', message: `Finalization failed: ${e.message}` });
    return { success: false, message: e.message };
  }
}

export async function downloadUpdate(version: string, downloadUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    await saveUpdateState({ status: 'DOWNLOADING', message: `Downloading update v${version}...` });
    
    if (!downloadUrl.startsWith('gridfs://')) {
      throw new Error('Unsupported download source. Must use GridFS.');
    }

    const filename = downloadUrl.replace('gridfs://', '');
    const paths = await getStoragePaths();
    
    // Ensure updates folder exists
    const updatesDir = path.join(paths.base, 'updates');
    if (!fsSync.existsSync(updatesDir)) {
      await fs.mkdir(updatesDir, { recursive: true });
    }
    
    const targetExePath = path.join(updatesDir, filename);

    try {
      // Download from MongoDB GridFS
      const db = await getDb();
      const { GridFSBucket } = await import('mongodb');
      const bucket = new GridFSBucket(db, { bucketName: 'updates' });
      
      // Get total file size for percentage
      const files = await db.collection('updates.files').find({ filename }).toArray();
      const totalBytes = files.length > 0 ? files[0].length : 0;
      
      await new Promise((resolve, reject) => {
        const downloadStream = bucket.openDownloadStreamByName(filename);
        const writeStream = fsSync.createWriteStream(targetExePath);
        
        let downloadedBytes = 0;
        let lastPercent = 0;
        
        downloadStream.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((downloadedBytes / totalBytes) * 100);
            if (percent > lastPercent) {
              lastPercent = percent;
              // Only update file every 5% to keep disk I/O incredibly fast
              if (percent % 5 === 0 || percent === 100) {
                saveUpdateState({ 
                  status: 'DOWNLOADING', 
                  message: `Downloading update v${version} (${percent}%)...` 
                }).catch(() => {});
              }
            }
          }
        });
        
        downloadStream.pipe(writeStream)
          .on('error', reject)
          .on('finish', () => resolve(true));
      });
    } catch (dbErr) {
      console.warn("MongoDB offline, falling back to HTTP download from live API", dbErr);
      const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
      if (!liveApiUrl) throw new Error("No live API URL configured for fallback download");
      
      const response = await fetch(`${liveApiUrl}/api/update/download-file?filename=${filename}`);
      if (!response.ok) throw new Error(`HTTP ${response.status} from live API`);
      
      const buffer = await response.arrayBuffer();
      await fs.writeFile(targetExePath, Buffer.from(buffer));
    }

    await saveUpdateState({ status: 'READY_TO_UPDATE', message: `Update downloaded to ${targetExePath}` });
    return { success: true, message: targetExePath };
  } catch (e: any) {
    console.error("Download failed:", e);
    await saveUpdateState({ status: 'FAILED', message: `Download failed: ${e.message}` });
    return { success: false, message: e.message };
  }
}

export async function installUpdate(exePath: string): Promise<{ success: boolean; message: string }> {
  try {
    await saveUpdateState({ status: 'INSTALLING', message: 'Launching installer...' });
    
    // Launch the .exe silently (NSIS installers support /S) and detach
    // We run it and let the current app close.
    const command = `"${exePath}" /S`;
    
    exec(command, (error) => {
      if (error) {
        console.error("Installer execution error:", error);
      }
    });

    // The installer should automatically kill this process and restart the app.
    // If not, we instruct the user.
    return { success: true, message: 'Installer launched. The application will restart shortly.' };
  } catch (e: any) {
    await saveUpdateState({ status: 'FAILED', message: `Install failed: ${e.message}` });
    return { success: false, message: e.message };
  }
}
