import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/receipt";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, imageDataUrl } = await req.json();
    if (!text && !imageDataUrl) {
      return NextResponse.json({ error: "Provide receipt text or an image." }, { status: 400 });
    }
    const parsed = await parseReceipt({ text, imageDataUrl });
    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not parse the receipt." }, { status: 500 });
  }
}
