import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { linqConfigured, sendText } from "@/lib/linq";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Proves the number works before the agent ever needs it. Reported honestly:
 * "sent" only when Linq accepted the message, never on the absence of an error.
 */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  if (!linqConfigured()) {
    return NextResponse.json({ error: "Texting isn't switched on yet." }, { status: 503 });
  }
  if (!user.phone) {
    return NextResponse.json({ error: "Add a mobile number first." }, { status: 400 });
  }
  if (user.smsOptOut) {
    return NextResponse.json(
      { error: "You replied STOP to an earlier text. Save your number again to turn them back on." },
      { status: 400 }
    );
  }

  const result = await sendText({
    to: user.phone,
    // No link: this is the first message to most people, and Linq asks that a
    // first message carries none.
    text: "This is Rebuy. Texts are working — I'll message you here if a price drops and I act on it. Reply STATUS any time, or STOP to stop.",
    chatId: user.linqChatId,
    idempotencyKey: `test:${user.id}:${Date.now()}`,
  });

  if (!result.ok) {
    console.error("[rebuy] test text failed", result.error);
    return NextResponse.json(
      { error: "Couldn't deliver the text. Check the number and try again." },
      { status: 502 }
    );
  }

  if (result.chatId && result.chatId !== user.linqChatId) {
    await prisma.user.update({ where: { id: user.id }, data: { linqChatId: result.chatId } });
  }

  return NextResponse.json({ ok: true, protocol: result.protocol });
}
