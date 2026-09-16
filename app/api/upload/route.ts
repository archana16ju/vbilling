import { NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.name)
    const filename = `${uniqueSuffix}${ext}`
    
    // Save to public/media
    const filepath = path.join(process.cwd(), "public", "media", filename)
    await writeFile(filepath, buffer)

    return NextResponse.json({ url: `/media/${filename}` })
  } catch (e) {
    console.error("Upload failed", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
