import { NextRequest, NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import fs from "fs"
import { getStoragePaths } from '@/lib/storage'
import { getDb } from '@/lib/actions/db'
import { GridFSBucket } from 'mongodb'
import { Readable } from 'stream'

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const resolvedParams = await params;
  const filename = resolvedParams.filename;
  
  const paths = await getStoragePaths();
  
  // We'll check productImages and categoryImages dirs
  const productFilepath = path.join(paths.productImages, filename);
  const categoryFilepath = path.join(paths.categoryImages, filename);
  
  let filepathToRead = '';

  if (fs.existsSync(productFilepath)) {
    filepathToRead = productFilepath;
  } else if (fs.existsSync(categoryFilepath)) {
    filepathToRead = categoryFilepath;
  } else {
    // Try to fetch from GridFS
    try {
      const db = await getDb();
      const bucket = new GridFSBucket(db, { bucketName: 'images' });
      
      const downloadStream = bucket.openDownloadStreamByName(filename);
      const chunks: Buffer[] = [];
      
      await new Promise<void>((resolve, reject) => {
        downloadStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        downloadStream.on('error', reject);
        downloadStream.on('end', resolve);
      });
      
      const buffer = Buffer.concat(chunks);
      
      // Save to local cache
      if (filename.startsWith('category-')) {
        filepathToRead = categoryFilepath;
      } else {
        filepathToRead = productFilepath;
      }
      await writeFile(filepathToRead, buffer);
      
    } catch (dbErr) {
      // Legacy fallback just in case
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share');
      const legacy1 = path.join(appData, 'billing-software', 'media', filename);
      const legacy2 = path.join(process.cwd(), "public", "media", filename);
      
      if (fs.existsSync(legacy1)) filepathToRead = legacy1;
      else if (fs.existsSync(legacy2)) filepathToRead = legacy2;
      else return new NextResponse('Image not found', { status: 404 });
    }
  }

  try {
    const buffer = await readFile(/*turbopackIgnore: true*/ filepathToRead);
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (e) {
    return new NextResponse('Image not found', { status: 404 });
  }
}
