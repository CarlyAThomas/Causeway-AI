import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🎬 VEO TRIGGERED:", body);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1alpha/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`;

    const generatePayload = {
      instances: [
        {
          prompt: body.prompt
        }
      ]
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generatePayload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Veo Error:", res.status, errorText);
      return NextResponse.json({ error: `Veo API Error: ${res.statusText}`, details: errorText }, { status: res.status });
    }

    const data = await res.json();
    console.log("Veo Response:", data);
    
    // data.name contains the operation ID for polling

    return NextResponse.json({ success: true, operationName: data.name });
  } catch (error: unknown) {
    console.error("Backend Error formatting tool call to Veo:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}