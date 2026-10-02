import { NextRequest, NextResponse } from "next/server"
import { getDb } from '@/lib/actions/db'
import { GridFSBucket } from 'mongodb'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  
  if (!filename) return new NextResponse('Missing filename', { status: 400 });

  try {
    const db = await getDb();
    const bucket = new GridFSBucket(db, { bucketName: 'updates' });
    
    const downloadStream = bucket.openDownloadStreamByName(filename);
    const chunks: Buffer[] = [];
    
    await new Promise<void>((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      downloadStream.on('error', reject);
      downloadStream.on('end', resolve);
    });
    
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return new NextResponse('File not found or DB offline', { status: 404 });
  }
}
