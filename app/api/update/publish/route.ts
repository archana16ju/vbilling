import { NextResponse } from 'next/server';
import { getDb } from '@/lib/actions/db';
import packageJson from '@/package.json';

// IMPORTANT: In production, this should be protected by an Admin session or API key.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await getDb();

    // Enforce matching the current code's package.json version
    const version = body.version || packageJson.version;
    const commit = body.commit || "unknown";
    const commitMessage = body.commitMessage || "Unknown commit message";
    const previousVersion = body.previousVersion || "unknown";
    const releaseNotes = body.releaseNotes || ["Update published via API"];
    const downloadUrl = body.downloadUrl || "https://drive.google.com/your-exe-link";
    const sha256 = body.sha256 || "unknown";

    const releaseData = {
      version,
      commit,
      commitMessage,
      previousVersion,
      releaseDate: new Date().toISOString(),
      releaseNotes,
      downloadUrl,
      sha256,
      mandatory: body.mandatory || false
    };

    // Insert or update the release
    await db.collection('releases').updateOne(
      { version: releaseData.version },
      { $set: releaseData },
      { upsert: true }
    );

    return NextResponse.json({ success: true, releaseData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
