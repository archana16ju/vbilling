import { NextRequest, NextResponse } from "next/server"
import net from "net"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { ip, port, rawText } = data

    if (!ip || !port || !rawText) {
      return NextResponse.json({ error: "Missing ip, port, or rawText" }, { status: 400 })
    }

    return await new Promise<NextResponse>((resolve) => {
      const client = new net.Socket()
      
      client.setTimeout(5000) // 5 seconds timeout
      
      client.on('error', (err) => {
        resolve(NextResponse.json({ success: false, error: "Connection error: " + err.message }))
        client.destroy()
      })
      
      client.on('timeout', () => {
        resolve(NextResponse.json({ success: false, error: "Connection timed out" }))
        client.destroy()
      })
      
      client.connect(parseInt(port), ip, () => {
        // Simple ESC/POS Init + Text + Cut
        const init = Buffer.from([0x1B, 0x40]) // Initialize printer
        const cut = Buffer.from([0x1D, 0x56, 0x41, 0x10]) // Partial cut
        
        const payload = Buffer.concat([
          init,
          Buffer.from(rawText, 'utf8'),
          Buffer.from('\n\n\n\n\n', 'utf8'), // feed lines
          cut
        ])
        
        client.write(payload, () => {
          client.end()
          resolve(NextResponse.json({ success: true }))
        })
      })
    })
  } catch (e: any) {
    console.error("Printer API error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
