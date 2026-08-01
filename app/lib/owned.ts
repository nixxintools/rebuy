import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { requireApiUser } from "./auth";

/**
 * Loads an item only if the signed-in user owns it. Returns 404 rather than 403
 * for someone else's item so the endpoint can't be used to probe for valid ids.
 */
export async function loadOwnedItem(id: string) {
  const { user, response } = await requireApiUser();
  if (!user) return { item: null, user: null, response };

  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) {
    return {
      item: null,
      user,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { item, user, response: null };
}
