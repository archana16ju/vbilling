import { NextRequest, NextResponse } from "next/server";
import net from "net";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ip, port = 9100, rawCommands } = body;

    if (!ip) {
      return NextResponse.json({ success: false, error: "Printer IP address is required" }, { status: 400 });
    }

    const targetPort = parseInt(String(port), 10) || 9100;

    // Action 1: Test Connection
    if (action === 'test-connection') {
      return await new Promise<NextResponse>((resolve) => {
        const client = new net.Socket();
        client.setTimeout(4000);

        client.on('error', (err) => {
          resolve(NextResponse.json({
            success: false,
            error: `Could not connect to printer at ${ip}:${targetPort} (${err.message})`
          }));
          client.destroy();
        });

        client.on('timeout', () => {
          resolve(NextResponse.json({
            success: false,
            error: `Connection to ${ip}:${targetPort} timed out. Ensure the printer is turned on and connected to the network.`
          }));
          client.destroy();
        });

        client.connect(targetPort, ip, () => {
          client.end();
          resolve(NextResponse.json({
            success: true,
            message: `Successfully connected to barcode printer at ${ip}:${targetPort}`
          }));
        });
      });
    }

    // Action 2: Send Raw Command Payload
    if (!rawCommands) {
      return NextResponse.json({ success: false, error: "No raw commands provided to print" }, { status: 400 });
    }

    return await new Promise<NextResponse>((resolve) => {
      const client = new net.Socket();
      client.setTimeout(6000);

      client.on('error', (err) => {
        resolve(NextResponse.json({
          success: false,
          error: `Printer communication error: ${err.message}`
        }));
        client.destroy();
      });

      client.on('timeout', () => {
        resolve(NextResponse.json({
          success: false,
          error: `Printer timed out while transmitting label data.`
        }));
        client.destroy();
      });

      client.connect(targetPort, ip, () => {
        const payload = Buffer.from(rawCommands, 'binary');
        client.write(payload, () => {
          client.end();
          resolve(NextResponse.json({
            success: true,
            message: `Label data sent successfully to ${ip}:${targetPort}`
          }));
        });
      });
    });
  } catch (err: any) {
    console.error("Barcode Printer API error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
