// Probes candidate storefronts for the three things Rebuy's price monitor needs:
// a public product feed, USD pricing, and a working single-product lookup.
// Re-runnable — this is also how we detect a merchant breaking later.
import { writeFileSync } from "node:fs";

const CANDIDATES = [
  // Electronics & accessories
  "anker.com", "us.anker.com", "moft.us", "nomadgoods.com", "peakdesign.com",
  "twelvesouth.com", "nativeunion.com", "casetify.com", "popsockets.com", "dbrand.com",
  "elevationlab.com", "orbitkey.com", "bellroy.com", "ridge.com", "mous.co",
  "spigen.com", "grovemade.com", "courant.co", "carvedeco.com", "pitaka.com",
  // Footwear
  "allbirds.com", "vessi.com", "rothys.com", "atoms.com", "cariuma.com",
  "olivercabell.com", "thousandfell.com", "veja-store.com", "kizik.com", "brooksrunning.com",
  // Apparel
  "tentree.com", "outerknown.com", "taylorstitch.com", "buckmason.com", "marinelayer.com",
  "fahertybrand.com", "vuoriclothing.com", "westernrise.com", "mackweldon.com", "ministryofsupply.com",
  "unboundmerino.com", "woolandprince.com", "publicrec.com", "chubbiesshorts.com", "birddogs.com",
  "everlane.com", "cuts.com", "trueclassictees.com", "asrv.com", "olivers.com",
  // Home & bedding
  "brooklinen.com", "parachutehome.com", "quince.com", "bollandbranch.com", "buffy.co",
  "coyuchi.com", "sijohome.com", "cozyearth.com", "ettitude.com", "silkandsnow.com",
  "thecompanystore.com", "riley.com", "nestbedding.com", "avocadogreenmattress.com", "saatva.com",
  // Kitchen
  "caraway.com", "madeincookware.com", "fromourplace.com", "greatjonesgoods.com", "misen.com",
  "materialkitchen.com", "hedleyandbennett.com", "fellowproducts.com", "food52.com", "greatjones.co",
  "equalparts.com", "brightland.co", "graza.co", "fly-by-jing.com", "omsom.com",
  // Outdoor & fitness
  "hydroflask.com", "yeti.com", "cotopaxi.com", "rumpl.com", "nemoequipment.com",
  "hyperlitemountaingear.com", "gossamergear.com", "bala.co", "tonal.com", "hyperice.com",
  "therabody.com", "onepeloton.com", "beyondyoga.com", "girlfriend.com", "outdoorvoices.com",
  // Beauty & personal care
  "glossier.com", "iliabeauty.com", "tula.com", "youthforia.com", "saiehello.com",
  "kosas.com", "versedskin.com", "hellobubble.com", "typology.com", "theordinary.com",
  "curology.com", "hims.com", "harrys.com", "billie.com", "everydayhumans.com",
  // Bags & travel
  "awaytravel.com", "monos.com", "july.com", "calpaktravel.com", "dagnedover.com",
  "baboontothemoon.com", "tortugabackpacks.com", "cotopaxi.com", "paravelco.com", "beis.com",
  // Pet
  "wildone.com", "fablepets.com", "thefarmersdog.com", "maxbone.com", "barkbox.com",
  // Eyewear & watches
  "warbyparker.com", "pairofthieves.com", "mvmt.com", "vincerowatches.com", "shinola.com",
  // Misc DTC
  "hellotushy.com", "getjinx.com", "drinkolipop.com", "poppi.com", "athleticgreens.com",
  "ritual.com", "seed.com", "caskers.com", "haus.com", "recess.com",
  "smiledirectclub.com", "quip.com", "burrow.com", "articleusa.com", "floyddetroit.com",
  "thuma.co", "benchmade.com", "leatherman.com", "topodesigns.com", "huckberry.com",
];

const TIMEOUT = 12000;

async function getJson(url) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "RebuyMerchantProbe/1.0" },
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.trim().startsWith("<")) return null; // HTML error page
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function probeHost(host) {
  const feed = await getJson(`https://${host}/products.json?limit=3`);
  const products = feed?.products;
  if (!Array.isArray(products) || products.length === 0) return null;

  const meta = await getJson(`https://${host}/meta.json`);
  const currency = meta?.currency ?? null;

  // A single-product lookup is what the price monitor actually calls.
  const handle = products.find((p) => p.variants?.length)?.handle;
  if (!handle) return null;
  const detail = await getJson(`https://${host}/products/${handle}.json`);
  const variant = detail?.product?.variants?.[0];
  if (!variant?.price) return null;

  return {
    host,
    currency,
    sampleHandle: handle,
    sampleTitle: detail.product.title,
    samplePrice: variant.price,
    variantCount: detail.product.variants.length,
  };
}

const results = [];
const seen = new Set();

for (const domain of CANDIDATES) {
  const base = domain.replace(/^www\./, "");
  if (seen.has(base)) continue;
  seen.add(base);

  // Some storefronts serve the feed only on one of apex / www.
  const hosts = domain.includes(".") && domain.split(".").length > 2 ? [domain] : [domain, `www.${domain}`];
  let hit = null;
  for (const host of hosts) {
    hit = await probeHost(host);
    if (hit) break;
  }

  if (hit && hit.currency === "USD") {
    results.push(hit);
    console.log(`OK    ${hit.host.padEnd(30)} ${String(hit.samplePrice).padStart(8)}  ${hit.sampleTitle.slice(0, 40)}`);
  } else if (hit) {
    console.log(`CUR   ${hit.host.padEnd(30)} currency=${hit.currency}`);
  } else {
    console.log(`no    ${domain}`);
  }
}

console.log(`\n=== ${results.length} usable USD Shopify storefronts of ${seen.size} candidates ===`);
writeFileSync("scripts/probe-results.json", JSON.stringify(results, null, 2));
