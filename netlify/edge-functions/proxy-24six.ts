// Netlify Edge Function: full same-origin reverse proxy for 24six so it works
// (login + session) embedded in the CycleScreen kiosk.
//
// Why this shape: 24six is a closed, CSRF-protected (Laravel-style, hence the
// 419) app. To keep its session consistent we must serve EVERYTHING through
// this one origin — the page, its assets, AND its login/API POSTs — instead of
// letting calls go straight to 24six.app cross-origin. We also bind 24six's
// Set-Cookie to this origin (strip Domain) and keep redirects on-origin.
//
// CycleScreen's own files are served untouched (we return early for them);
// every other path is proxied to 24six.app.
//
// Caveat: if 24six hardcodes absolute https://24six.app URLs in its JS, or uses
// OAuth/social login or DRM, those can still bypass the proxy. Email/password
// login is what this is meant to fix.

const FIRST_PARTY_EXACT = new Set(["/", "/index.html", "/favicon.ico", "/netlify.toml"]);
const FIRST_PARTY_PREFIX = ["/js/", "/css/", "/.netlify/"];

export default async (request: Request) => {
  const url = new URL(request.url);
  const p = url.pathname;

  // Serve CycleScreen's own assets normally.
  if (FIRST_PARTY_EXACT.has(p) || FIRST_PARTY_PREFIX.some((x) => p.startsWith(x))) return;

  const upstreamPath = p.startsWith("/24six") ? (p.replace(/^\/24six/, "") || "/") : p;
  const target = "https://24six.app" + upstreamPath + url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("accept-encoding");
  // Tell 24six the request originates from itself (helps CSRF origin checks).
  headers.set("origin", "https://24six.app");
  headers.set("referer", "https://24six.app" + upstreamPath);

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();

  let up: Response;
  try {
    up = await fetch(target, init);
  } catch {
    return new Response("24six is unreachable from the proxy.", { status: 502 });
  }

  const rh = new Headers(up.headers);
  rh.delete("x-frame-options");
  rh.delete("content-security-policy");
  rh.delete("content-security-policy-report-only");
  rh.delete("content-encoding");
  rh.delete("content-length");

  // Bind 24six's cookies to THIS origin so the session is consistent.
  rh.delete("set-cookie");
  const cookies = (up.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of cookies) {
    rh.append("set-cookie", c.replace(/;\s*Domain=[^;]+/i, ""));
  }

  // Keep redirects on our origin and inside the 24six space (so a post-login
  // redirect to "/" shows 24six's home, not CycleScreen).
  const loc = rh.get("location");
  if (loc) {
    let nl = loc.replace(/^https?:\/\/24six\.app/i, "");
    if (nl === "" || nl === "/") nl = "/24six/";
    rh.set("location", nl);
  }

  // If 24six hardcodes absolute https://24six.app URLs in its HTML/JS/JSON, those
  // calls bypass the proxy (and break the session → 419). Rewrite them to
  // same-origin so they route back through here.
  const ct = (up.headers.get("content-type") || "").toLowerCase();
  const isText = /text\/html|javascript|application\/json|text\/css|application\/xml/.test(ct);
  if (isText) {
    let body = await up.text();
    body = body
      .replaceAll("https://24six.app", "")
      .replaceAll("http://24six.app", "")
      .replaceAll("https:\\/\\/24six.app", "") // escaped in JSON / JS string literals
      .replaceAll("http:\\/\\/24six.app", "");
    return new Response(body, { status: up.status, headers: rh });
  }

  return new Response(up.body, { status: up.status, headers: rh });
};

export const config = { path: "/*" };
