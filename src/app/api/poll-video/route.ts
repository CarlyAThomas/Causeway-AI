import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { operationName } = await req.json();
    if (!operationName) {
      return NextResponse.json({ error: "Missing operationName" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1alpha/${operationName}?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Veo Polling Error:", res.status, errorText);
      return NextResponse.json({ error: `Veo Polling Error: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    
    // Check if done
    if (data.done) {
      console.log("🎬 VEO POLL COMPLETED:", JSON.stringify(data, null, 2));
      // The video URI should be somewhere in the response, likely in data.response.generatedFiles or similar based on Veo API docs.
      return NextResponse.json({ success: true, done: true, data });
    } else {
      return NextResponse.json({ success: true, done: false });
    }
  } catch (error: unknown) {
    console.error("Backend Error polling Veo:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}