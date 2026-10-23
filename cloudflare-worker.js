var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .freebuff/bhumi-tile-worker.js
var BHUMI_BASE = "https://bhumi.atrbpn.go.id";
var BHUMI_ORIGIN = "https://bhumi.atrbpn.go.id";
var BHUMI_REFERER = "https://bhumi.atrbpn.go.id/";
var BHUMI_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
function bhumiRequestHeaders(contentType) {
  const headers = new Headers({
    Accept: "*/*",
    "Accept-Language": "id-ID,id;q=0.9,en-ID;q=0.8,en;q=0.7,en-US;q=0.6",
    Origin: BHUMI_ORIGIN,
    Referer: BHUMI_REFERER,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": BHUMI_UA,
    "sec-ch-ua": '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"'
  });
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}
// GISTARU (WMS RTR Provinsi & GetFeatureInfo zona RTR/RTRW).
// Sejak 14 Okt 2026 WAF gistaru-app.atrbpn.go.id membalas 403
// {"error":"Akses ditolak"} untuk SEMUA Referer kecuali https://bhumi.atrbpn.go.id/
// (uji curl: tanpa Referer 403, Referer localhost/github.io/atrbpn.go.id 403,
// Referer bhumi.atrbpn.go.id 200). Browser tidak bisa mengubah Referer, jadi
// GetMap tile & klik peta (GetFeatureInfo) harus lewat route /gistaru ini.
// Dipakai app: <worker>/gistaru/interoppublic/api/wms/{uuid}?<query WMS>
var GISTARU_BASE = "https://gistaru-app.atrbpn.go.id";
var GISTARU_PREFIX = "/gistaru";
// Restricted ArcGIS identify relay for the Central Java RTRW service.
// Do not accept an upstream URL from the caller: the HAR route uses this
// fixed service behind GISTARU's same-origin proxy.
var GISTARU_RTRONLINE_PATH = "/gistaru-rtronline";
var GISTARU_RTRONLINE_IDENTIFY = "https://gistaru.atrbpn.go.id/arcgis/rest/services/022_RTR_KABUPATEN_KOTA_PROVINSI_JAWA_TENGAH/_3300_JAWA_TENGAH_PR_PERDA/MapServer/identify";
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Client-Pubkey,X-Ticket-Id,X-Timestamp",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
var bhumi_tile_worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (path === GISTARU_RTRONLINE_PATH) {
      if (request.method !== "GET") {
        return new Response("method not allowed", { status: 405, headers: corsHeaders() });
      }
      const allowedParams = ["geometry", "geometryType", "sr", "tolerance", "mapExtent", "imageDisplay", "returnGeometry"];
      const params = new URLSearchParams();
      params.set("f", "json");
      params.set("layers", "all");
      for (const key of allowedParams) {
        const value = url.searchParams.get(key);
        if (value != null && value.length <= 4096) params.set(key, value);
      }
      const wrappedUrl = "https://gistaru.atrbpn.go.id/proxy_rtronline/run.ashx?" +
        GISTARU_RTRONLINE_IDENTIFY + "?" + params.toString();
      const upstream = await fetch(wrappedUrl, {
        method: "GET",
        headers: new Headers({
          Accept: "application/json",
          Origin: "https://gistaru.atrbpn.go.id",
          Referer: "https://gistaru.atrbpn.go.id/rtronline/",
          "User-Agent": BHUMI_UA
        })
      });
      const responseHeaders = new Headers(upstream.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders
      });
    }
    // ── Route GISTARU (WMS RTR Provinsi + GetFeatureInfo zona RTR/RTRW) ──
    // Meneruskan ke gistaru-app.atrbpn.go.id dengan Referer/Origin bhumi
    // (satu-satunya Referer yang diterima WAF mereka) + CORS *.
    if (path === GISTARU_PREFIX || path.startsWith(GISTARU_PREFIX + "/")) {
      const rest = path.slice(GISTARU_PREFIX.length) || "/";
      const gistaruHeaders = new Headers({
        Accept: "*/*",
        Origin: BHUMI_ORIGIN,
        Referer: BHUMI_REFERER,
        "User-Agent": BHUMI_UA
      });
      const gistaruCT = request.headers.get("Content-Type");
      if (gistaruCT) gistaruHeaders.set("Content-Type", gistaruCT);
      const gistaruUpstream = await fetch(GISTARU_BASE + rest + url.search, {
        method: request.method,
        headers: gistaruHeaders,
        body: request.method === "GET" || request.method === "HEAD" ? void 0 : request.body
      });
      const gistaruResponseHeaders = new Headers(gistaruUpstream.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => gistaruResponseHeaders.set(key, value));
      return new Response(gistaruUpstream.body, {
        status: gistaruUpstream.status,
        statusText: gistaruUpstream.statusText,
        headers: gistaruResponseHeaders
      });
    }
    if (path === "/expapi/getPersil" && request.method === "POST") {
      const headers2 = bhumiRequestHeaders("application/json");
      const auth2 = request.headers.get("Authorization");
      if (auth2) headers2.set("Authorization", auth2);
      for (const name of ["X-Client-Pubkey", "X-Ticket-Id", "X-Timestamp"]) {
        const value = request.headers.get(name);
        if (value) headers2.set(name, value);
      }
      const upstream2 = await fetch(BHUMI_BASE + path, {
        method: "POST",
        headers: headers2,
        body: request.body
      });
      const responseHeaders2 = new Headers(upstream2.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders2.set(key, value));
      return new Response(upstream2.body, {
        status: upstream2.status,
        statusText: upstream2.statusText,
        headers: responseHeaders2
      });
    }
    const allowed = ["/mprx/", "/expapi/", "/api/", "/panel/", "/shortlink"];
    if (!allowed.some((prefix) => path.startsWith(prefix))) {
      return new Response("not allowed", { status: 403, headers: corsHeaders() });
    }
    const headers = bhumiRequestHeaders(request.headers.get("Content-Type"));
    const auth = request.headers.get("Authorization");
    if (auth) headers.set("Authorization", auth);
    const upstream = await fetch(BHUMI_BASE + path + url.search, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? void 0 : request.body
    });
    const responseHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  }
};
export {
  bhumi_tile_worker_default as default
};
//# sourceMappingURL=bhumi-tile-worker.js.map
