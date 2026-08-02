import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { linqConfigured, maskPhone, toE164 } from "@/lib/linq";

export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().min(1) });

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  return NextResponse.json({
    available: linqConfigured(),
    phone: user.phone ? maskPhone(user.phone) : null,
    optedOut: user.smsOptOut,
  });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });
  }

  const phone = toE164(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a mobile number. Use the full number with its country code, like +1 206 261 9826.",
      },
      { status: 400 }
    );
  }

  // Saving a number is also the user asking for texts again, so it clears an
  // earlier STOP. Anything else would leave them adding a number that silently
  // never gets used.
  await prisma.user.update({
    where: { id: user.id },
    data: { phone, smsOptOut: false, linqChatId: null },
  });

  return NextResponse.json({ ok: true, phone: maskPhone(phone), optedOut: false });
}

export async function DELETE() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  await prisma.user.update({
    where: { id: user.id },
    data: { phone: null, linqChatId: null },
  });
  return NextResponse.json({ ok: true, phone: null });
}
