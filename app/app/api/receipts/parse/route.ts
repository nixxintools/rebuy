import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/receipt";
import { requireApiUser } from "@/lib/auth";

export const maxDuration = 60;

const MAX_INPUT_CHARS = 20000;

export async function POST(req: NextRequest) {
  // This calls a paid model, so it can't be left open to anonymous callers.
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const { text, imageDataUrl } = await req.json();
    if (typeof text === "string" && text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: "That receipt is too long — paste just the order confirmation." },
        { status: 413 }
      );
    }
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
