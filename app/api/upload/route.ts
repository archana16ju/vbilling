import { NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"
import { GridFSBucket } from 'mongodb'
import { getDb } from '@/lib/actions/db'
import { ensureStorageDirectories, getStoragePaths, addMediaSyncAction } from '@/lib/storage'
import { Readable } from 'stream'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File
    const type = data.get("type") as string || "product"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const originalBuffer = Buffer.from(bytes)

    // Compress using sharp to WebP
    const buffer = await sharp(originalBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const filename = `${type}-${uniqueSuffix}.webp`
    
    // Save to local cache FIRST
    const paths = await getStoragePaths();
    const filepath = type === 'category' 
      ? path.join(paths.categoryImages, filename)
      : path.join(paths.productImages, filename);
      
    await writeFile(filepath, buffer)

    // Try Upload to GridFS
    try {
      const db = await getDb();
      const bucket = new GridFSBucket(db, { bucketName: 'images' });
      
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { contentType: 'image/webp' }
      });
      
      await new Promise<void>((resolve, reject) => {
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });
    } catch (dbErr) {
      console.warn("MongoDB upload failed, relying on local cache and queuing for sync", dbErr);
      await addMediaSyncAction(filename, type.toUpperCase() as 'CATEGORY' | 'PRODUCT', null, filepath);
    }

    return NextResponse.json({ url: `/api/media/${filename}` })
  } catch (e) {
    console.error("Upload failed", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
