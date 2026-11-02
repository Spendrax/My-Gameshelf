// BARCODE HELPER — a free Cloudflare Worker that lets My Gameshelf look up barcodes on UPCitemdb.
// UPCitemdb blocks calls made straight from web pages, so the app asks this helper, and the helper asks UPCitemdb.
// Set up (once): Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy,
// then put the worker's address in BARCODE_HELPER at the top of js/13-scan.js.

export default {
  async fetch(request) {
    const headers = {
      'Access-Control-Allow-Origin': 'https://spendrax.github.io', // only your app may use it
      'Content-Type': 'application/json',
    };
    const upc = new URL(request.url).searchParams.get('upc') || '';
    if (!/^\d{8,14}$/.test(upc)) return new Response('{"items":[]}', { headers });

    // Results are kept for 30 days, so scanning the same game again doesn't use up the daily lookups
    const answer = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      cf: { cacheTtl: 2592000, cacheEverything: true },
    });
    return new Response(await answer.text(), { status: answer.status, headers });
  },
};
