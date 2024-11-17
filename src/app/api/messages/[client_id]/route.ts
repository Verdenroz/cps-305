import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const peer = searchParams.get('peer');
  const client_id = req.nextUrl.pathname.split('/').pop();

  if (!client_id) {
    return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
  }

  let url = `http://127.0.0.1:8000/messages/${client_id}`;
  if (peer) {
    url += `?peer=${peer}`;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch messages: ${response.statusText}` }, { status: response.status });
    }

    const messages = await response.json();
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: `Failed to fetch messages: ${error.message}` }, { status: 500 });
  }
}