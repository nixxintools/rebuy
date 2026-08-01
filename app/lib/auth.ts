import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const COOKIE = "rebuy_session";
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MINUTES = 15;

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function mintToken() {
  return randomBytes(32).toString("base64url");
}

export async function createLoginToken(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
  const raw = mintToken();
  await prisma.loginToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId: user.id,
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000),
    },
  });
  return { user, raw };
}

export async function consumeLoginToken(raw: string) {
  const token = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) return null;
  await prisma.loginToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
  return token.user;
}

export async function createSession(userId: string) {
  const raw = mintToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { tokenHash: hashToken(raw), userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
  jar.delete(COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

/** For server components: send anonymous visitors to the sign-in page. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** For route handlers: returns the user, or a 401 response to return directly. */
export async function requireApiUser() {
  const session = await getSession();
  if (!session) {
    return { user: null, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  return { user: session.user, response: null };
}

/** Constant-time compare for the cron bearer secret. */
export function secretMatches(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE = COOKIE;
