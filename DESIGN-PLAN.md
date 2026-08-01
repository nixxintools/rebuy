# Rebuy — Material Design website + real login

## Context

Rebuy today is a hackathon demo: a dark, single-page Next.js app with **no landing page, no accounts, and no auth at all**. Identity is a free-text email box on the "add a receipt" form (`app/app/add/page.tsx:180`), stored as a plain `userEmail` string on every item. Because we never built an auth layer, our own endpoints are wide open: `GET /api/items` returns *every* item in the database to any visitor, any anonymous caller can push a fake price into someone else's item, and the cron endpoint is a public unauthenticated GET. These are gaps in our application code — the payment layer is unaffected, and adding sessions closes all of them.

We want it to read as a real product, modelled on **warrantifyapp.com** — a bright marketing site that explains the problem, shows the three-step flow, and funnels to a sign-in — but as a **website**, not an app download. Visual language: **Material Design** (MUI), light theme, blue primary with teal accent. Plus a genuine login experience: passwordless **magic link by email**, sessions, and a properly gated app.

Outcome: a public landing page at `/`, a real sign-in at `/login`, and the existing agent app moved behind auth at `/dashboard`, all rebuilt in Material components.

### Ground truth about the current code (verified)

- Next.js **16.2.12**, React **19.2.4**, Tailwind **v4** (CSS-first, no `tailwind.config`), Prisma **6.19.3**, `zod@4.4.3` installed but unused.
- `app/app/globals.css` is untouched create-next-app boilerplate and actively conflicts with `layout.tsx` (it sets `font-family: Arial` and a light background; the layout hardcodes `bg-[#0a0a0b]`). No design tokens exist — the "design system" is inline Tailwind strings.
- Prisma has exactly three models: `TrackedItem`, `PricePoint`, `AgentEvent`. **No `User`, no `Session`.** No `prisma/migrations/` directory exists.
- `lib/prava.ts` sends `userEmail` as **both** `user_id` and `user_email` to Prava. Prava's customer key is the email — auth must not break that mapping.
- The merchant layer is live and real: `lib/merchants.ts` (Anker / Allbirds / Brooklinen Shopify feeds), used by `POST /api/items` and `/api/merchants/search`.
- **Uncommitted work exists.** `git status` shows ~10 modified files plus untracked `app/lib/merchants.ts` and `app/app/api/merchants/`. The GitHub repo is behind the working tree. **Commit that first, before this work starts.**

### Next.js 16 constraints (from `node_modules/next/dist/docs/`)

- `middleware.ts` is gone — the file convention is now **`proxy.ts`** at the project root, and it needs a `config.matcher` or it runs on every static asset. It may run on the CDN, so it must not import Prisma; do a cheap cookie check there and enforce real authorization in route handlers.
- `cookies()` and `headers()` are **async** — synchronous access was removed, not deprecated.
- Turbopack is the default builder; a dependency injecting a webpack config will fail the build.

---

## 1. Design system — Material 3, Warrantify palette

Install MUI and wire it to coexist with Tailwind:

```bash
npm i @mui/material@9 @mui/material-nextjs @mui/icons-material @emotion/react @emotion/styled @emotion/cache
```

**`app/lib/theme.ts`** (new) — one `createTheme` exported and reused everywhere:

| Role | Value | Source |
|---|---|---|
| primary | `#2563eb` | Warrantify's blue-600 |
| secondary | `#0d9488` | Warrantify's teal-600 |
| success / error / warning | `#16a34a` / `#ef4444` / `#ea580c` | matches reference |
| background.default | `#ffffff`, sections alternate `#f9fafb` | |
| text primary/secondary | `#111827` / `#4b5563` | |
| shape.borderRadius | `16` | Material 3 "large" |
| typography | **Roboto** via `next/font/google` | Material's typeface |

Signature gradient `linear-gradient(135deg, #2563eb, #0d9488)` for the logo mark, step badges, and the hero CTA — the reference site's one strong visual motif.

**`app/app/layout.tsx`** — replace the dark hardcoded shell with `<AppRouterCacheProvider options={{ enableCssLayer: true }}>` (the CSS-layer flag is what stops MUI and Tailwind fighting over specificity) wrapping `<ThemeProvider>` + `<CssBaseline />`. Root layout becomes a shell only; the header moves into two route-group layouts.

**`app/app/globals.css`** — strip the boilerplate down to `@import "tailwindcss";`. All colour and type decisions live in the MUI theme from here.

**Route groups** so marketing and app can have different chrome without duplicating the root layout:
- `app/(marketing)/` → `layout.tsx` with the transparent-to-solid scrolling `AppBar`, anchor nav, and footer; contains `page.tsx` (landing) and `login/`.
- `app/(app)/` → `layout.tsx` with the signed-in `AppBar` (logo, "Track a purchase" `Button`, account `Menu` with sign out); contains `dashboard/`, `add/`, `items/[id]/`, `prava/return/`.

New shared components under `app/components/`: `Logo.tsx` (recolour to the blue→teal gradient), `MarketingNav.tsx`, `Footer.tsx`, `Section.tsx`, `FeatureCard.tsx`, `StepCard.tsx`, `StatusChip.tsx`, `MoneyStat.tsx`.

---

## 2. Landing page — `app/(marketing)/page.tsx`

Server component. Warrantify's section order, rewritten for rebuy:

**Copy rule: the landing page sells the outcome, not the plumbing.** No Prava branding in the hero, no "sandbox" or "demo" disclaimers, no section explaining mandates, passkeys, or spend caps. Payment mechanics are an implementation detail the user meets *after* signing up, on the item page — putting them on the landing page markets our vendor instead of our service, and raises doubts the visitor didn't arrive with. Prava appears once, quietly, in the footer.

1. **Hero** — `h1` "Your purchase just got cheaper. Get the difference." Subhead on the return-window gap. Two buttons: filled "Start tracking free" → `/login`, outlined "See how it works" → `#how`. Soft blue radial glow behind, per the reference. Reassurance caption is about commitment, not payments: "Free to start · Nothing charged unless it saves you money."
2. **Problem vs Solution** — two `Card`s side by side. Left: red `CloseIcon` rows (prices drop days after you buy; retailers won't refund the difference; return-and-rebuy is too much hassle; the window closes and you eat the loss). Right: green `CheckIcon` rows (it watches the live price; it rebuys the moment the price drops; your return comes prepped and dated; you keep the difference).
3. **How it works** — three gradient numbered circles (`StepCard`): Paste your receipt → Turn it on → It captures the drop. Step 2 is described in plain terms ("one tap and it starts working"), not as a mandate approval.
4. **Features** — 4 `FeatureCard`s, all framed as user benefit: reads any receipt · watches the real store price, all day · acts inside your return window · shows you exactly what it saved.
5. **Use cases** — three cards: electronics buyers, frequent online shoppers, households.
6. **Screenshots** — horizontal scroller of dashboard / item views, mirroring the reference's carousel.
7. **Final CTA band** + **Footer** (privacy, terms, contact, and a single "Payments secured by Prava" line).

Everything cut from here — the mandate guardrails, the passkey, the one-charge cap, the expiry — still gets explained *in the product*, on the authorize step and the item page, where the user is deciding whether to grant the spend and the detail is reassuring rather than alarming.

`metadata` in the marketing layout gets a real title, description, and OpenGraph block.

---

## 3. Auth — passwordless magic link

### Schema (`app/prisma/schema.prisma`)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  items     TrackedItem[]
  sessions  Session[]
  tokens    LoginToken[]
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique          // sha256 of the cookie value; raw token never stored
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model LoginToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  userId    String
  expiresAt DateTime                  // 15 minutes
  usedAt    DateTime?                 // single use
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`TrackedItem` gains `userId String` + `user User @relation(...)` and `@@index([userId])`. **Keep `userEmail`** — `lib/prava.ts` uses it as the Prava customer id and existing mandates would become unfindable without it.

There are no migrations today, so: `prisma migrate dev --name init_auth` creates the baseline. Existing rows need a `userId`, so the migration should backfill — create a `User` per distinct `userEmail`, then point items at it — before the column goes `NOT NULL`.

### `app/lib/auth.ts` (new) — the whole auth surface

- `hashToken(raw)` — sha256 hex; only hashes are ever persisted.
- `createLoginToken(email)` — upsert the `User`, mint 32 random bytes, store the hash with a 15-minute expiry.
- `consumeLoginToken(raw)` — verify, reject expired/used, stamp `usedAt`, return the user.
- `createSession(userId)` / `destroySession()` — mint a session token, store the hash, set/clear the `rebuy_session` cookie (`httpOnly`, `secure` in prod, `sameSite: "lax"`, `path: "/"`, 30 days).
- `getSession()` — `await cookies()`, look up by hash, return `{ user } | null`.
- `requireUser()` — `getSession()` or `redirect("/login")`, for server components.
- `requireApiUser()` — returns the user or a `401` `NextResponse`, for route handlers.

### `app/lib/email.ts` (new)

`sendMagicLink(email, url)` via **Resend**. If `RESEND_API_KEY` is unset, log the URL to the server console and (in non-production only) return it in the API response so the flow is demoable without email delivery. Sender: `login@upthink.app` — **prerequisite: verify `upthink.app` in Resend**, otherwise fall back to `onboarding@resend.dev`, which can only deliver to the Resend account owner's own address.

### Routes

| Route | Method | Behaviour |
|---|---|---|
| `/api/auth/request` | POST | zod-validate email → `createLoginToken` → `sendMagicLink` → always return the same 200, whether or not the address exists (no account enumeration). Rate limit: 3/email/15min, in-memory is fine at this scale. |
| `/api/auth/callback` | GET | `?token=` → `consumeLoginToken` → `createSession` → 302 to `/dashboard`. On failure → `/login?error=expired`. |
| `/api/auth/logout` | POST | `destroySession` → 302 to `/`. |

### Pages

- **`/login`** — centred Material `Card`, logo, "Sign in to Rebuy", `TextField` (outlined, floating label, `type="email"`), full-width filled `Button` "Email me a sign-in link", `LinearProgress` while sending, `Alert` for errors, small "No password needed" caption. On success the card swaps to a **check-your-email** state: mail icon, "We sent a link to *you@example.com*", "Open the link on this device", plus a resend link with a 30s cooldown. In dev with no Resend key, the returned link renders as a clickable button so the demo never stalls.
- **`/login?error=expired`** — the same card with an `Alert` explaining the link expired and a one-tap re-request.

### `proxy.ts` (project root, sibling of `app/`)

Cookie-presence check only — no Prisma import, since this can run on the CDN. Redirect unauthenticated requests for `/dashboard`, `/add`, `/items/*`, `/prava/*` to `/login?next=<path>`; bounce already-signed-in users away from `/login` to `/dashboard`. Matcher must exclude `_next/static`, `_next/image`, `favicon.ico`, and `/api/*`.

```ts
export const config = { matcher: ["/dashboard/:path*", "/add/:path*", "/items/:path*", "/prava/:path*", "/login"] };
```

---

## 4. Locking down the API

This is the substance of "a proper login experience" — the gate has to be on the server, not just the router.

- **`GET /api/items`** — scope to `session.user.id`. Currently returns the entire table.
- **`POST /api/items`** — take `userId`/`userEmail` from the session, **not the request body**. Drop `userEmail` from the request contract and remove the email field from the add form entirely.
- **All five `/api/items/[id]/*` routes** (`GET`, `authorize`, `confirm-mandate`, `price`, `revoke`) — load the item, `404` if `item.userId !== user.id`. A 404 rather than a 403 avoids confirming that an id exists.
- **`/api/cron/check-prices`** — require `Authorization: Bearer ${CRON_SECRET}`; Vercel Cron sends this automatically once the env var is set. Today anyone can GET it and force a sweep.
- Validate request bodies with the already-installed `zod` — no new dependency.

New env vars: `RESEND_API_KEY`, `CRON_SECRET`, `EMAIL_FROM`. `APP_BASE_URL` already exists and is reused for the magic-link URL. All three must be mirrored into Vercel project settings.

---

## 5. Restyling the app pages

Same behaviour, Material components, light theme, and one route move.

| File | Change |
|---|---|
| `app/(app)/dashboard/page.tsx` | Moved from `app/page.tsx`. Becomes a **server component** — `requireUser()` then query Prisma directly, dropping the client-side fetch waterfall. Hero savings `Card` with the gradient, item `List` with `Avatar` product images (already stored in `imageUrl`), `StatusChip` per status, `Skeleton` via `loading.tsx`. Empty state = an illustrated `Card` with the 3-step recap and a filled CTA. |
| `app/(app)/add/page.tsx` | Stays a client component. Merchant picker becomes `ToggleButtonGroup`; receipt paste becomes a multiline `TextField`; the parsed-fields form becomes outlined `TextField`s with `error`/`helperText` where confidence < 0.8; product matches become a `List` of `ListItemButton` with `Avatar` + price; the whole thing wraps in a `Stepper` (Paste → Confirm → Pick product). **Delete the email input** — it comes from the session now. |
| `app/(app)/items/[id]/page.tsx` | The 346-line page splits into components: `ItemHeader`, `AgentStepper` (MUI `Stepper`), `MoneyStat` row, `MandateCard` (the guardrail rows as a `List` with icons, plus a "Passkey-approved" `Chip` and a destructive `Button` behind a confirm `Dialog`), `PriceWatchCard`, `ReturnHandoffCard`, and `ActivityTimeline` (`Accordion` per event, raw JSON inside). |
| `app/(app)/prava/return/page.tsx` | `CircularProgress` + status text in a centred `Card`. Keep the existing retry logic and the `Suspense` wrapper — `useSearchParams` still requires it. |
| `app/(app)/layout.tsx` | Signed-in `AppBar`: logo, "Track a purchase" filled `Button`, account `Menu` (email + Sign out posting to `/api/auth/logout`). |

Also add `app/(app)/loading.tsx` and a shared `error.tsx` — neither exists today.

---

## Build order

1. Commit the outstanding merchant-pivot changes and push (the repo is currently behind).
2. MUI + theme + `globals.css` cleanup + route groups — no behaviour change yet.
3. Landing page.
4. Prisma auth models + migration with backfill.
5. `lib/auth.ts`, `lib/email.ts`, the three auth routes, `/login`, `proxy.ts`.
6. API lockdown (user scoping, ownership checks, `CRON_SECRET`).
7. Restyle dashboard / add / item / return.

Steps 2–3 and 4–5 are independently testable; do not start 6 before 5 works, or you'll lock yourself out of your own dev data.

---

## Verification

**Auth, without an email provider** — unset `RESEND_API_KEY`, `npm run dev`, go to `/login`, submit an address, click the link surfaced in the dev response. Expect a `rebuy_session` cookie and a redirect to `/dashboard`.

**Auth, end to end** — set `RESEND_API_KEY` and a verified sender, repeat, and confirm the email arrives and the link works from a different browser.

**The gate actually holds** (the part that matters — test with `curl`, not the UI, since `proxy.ts` only guards the browser):
```bash
curl -i http://localhost:3000/api/items
```
Expect `401`, not a list of items. Then sign in as user A, create an item, sign in as user B in a private window, and `curl` A's item id with B's cookie — expect `404`. Repeat for `authorize`, `price`, and `revoke`. Confirm `/api/cron/check-prices` returns `401` without the bearer token and works with it.

**Single-use links** — click the same magic link twice; the second click must land on `/login?error=expired`.

**Product flow still works** — signed in, paste a receipt, confirm the parse, pick a live product, authorize with Prava sandbox, return via `/prava/return`, push a lower price on the item page, and confirm the rebuy fires and the return hand-off renders. This exercises `lib/agent.ts` and `lib/prava.ts` unchanged.

**Build and visuals** — `npm run build` must pass under Turbopack (watch for any MUI-injected webpack config). Then check `/`, `/login`, `/dashboard`, and `/items/[id]` at 375px, 768px, and 1280px with the browser tools, and confirm no Tailwind/MUI style conflicts (the `enableCssLayer` flag is what prevents them).
