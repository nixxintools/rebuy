import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Every field is required together. A merchant rejects a partial address at the
 * final step, which is the worst possible moment to discover it — the money has
 * already moved by then.
 */
const Body = z.object({
  name: z.string().trim().min(2, "Enter the full name the parcel is addressed to."),
  street: z.string().trim().min(3, "Enter the street address."),
  locality: z.string().trim().min(1, "Enter the town or city."),
  region: z.string().trim().min(2, "Enter the state or region."),
  postalCode: z.string().trim().min(3, "Enter the postal or ZIP code."),
  country: z
    .string()
    .trim()
    .length(2, "Use the two-letter country code, like US.")
    .transform((c) => c.toUpperCase()),
});

function shape(u: {
  shipName: string | null;
  shipStreet: string | null;
  shipLocality: string | null;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
}) {
  if (!u.shipName || !u.shipStreet || !u.shipCountry) return null;
  return {
    name: u.shipName,
    street: u.shipStreet,
    locality: u.shipLocality,
    region: u.shipRegion,
    postalCode: u.shipPostalCode,
    country: u.shipCountry,
  };
}

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  return NextResponse.json({ address: shape(user) });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the address and try again." },
      { status: 400 }
    );
  }
  const a = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      shipName: a.name,
      shipStreet: a.street,
      shipLocality: a.locality,
      shipRegion: a.region,
      shipPostalCode: a.postalCode,
      shipCountry: a.country,
    },
  });

  return NextResponse.json({ ok: true, address: shape(updated) });
}

export async function DELETE() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      shipName: null,
      shipStreet: null,
      shipLocality: null,
      shipRegion: null,
      shipPostalCode: null,
      shipCountry: null,
    },
  });
  return NextResponse.json({ ok: true, address: null });
}
