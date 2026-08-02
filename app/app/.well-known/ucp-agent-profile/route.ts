import { NextResponse } from "next/server";

// The agent profile UCP-compliant merchants require before they'll transact
// with us. Publishing this is what lets Rebuy attempt a real checkout at a
// merchant rather than only reserving payment via Prava.
const PROFILE = {
  ucp: {
    version: "2026-04-08",
    agent: {
      name: "Rebuy",
      url: "https://rebuy.upthink.app",
      description: "Autonomous agent that repurchases at a lower price within a user's return window.",
    },
    capabilities: {
      "dev.ucp.shopping.cart": [{ version: "2026-04-08" }],
      "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
    },
  },
  signing_keys: [
    {
      kid: "rebuy-2026-08",
      kty: "EC",
      crv: "P-256",
      x: "FMD4TdKm7699HAxJkGZ_DRMTQhhfgJcQRakIuSSMFW8",
      y: "G3EuWkJQhLhyKRbN1ocVBlz2RdIXy-2sub7Kzj7fWUA",
      use: "sig",
      alg: "ES256",
    },
  ],
};

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(PROFILE, { headers: { "Cache-Control": "public, max-age=3600" } });
}
