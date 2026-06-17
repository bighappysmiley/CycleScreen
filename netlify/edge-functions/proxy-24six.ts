// Netlify Edge Function: reverse-proxy 24six so it can be embedded in the
// CycleScreen kiosk. Closed apps block framing with X-Frame-Options / CSP
// frame-ancestors; this fetches 24six from the server side and strips those
// headers so the iframe at /24six/* renders inside CycleScreen instead of
// being blocked or forcing a new tab.
//
// NOTE: 24six is a closed, authenticated app. Stripping the framing headers
// lets it DISPLAY in-kiosk, but its login/streaming calls are still its own
// cross-origin/cookie-gated API — full playback may not work through a proxy.
export default async (request: Request) => {
  const url = new URL(request.url);
  const upstreamPath = url.pathname.replace(/^\/24six/, "") || "/";
  const target = "https://24six.app" + upstreamPath + url.search;

  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    redirect: "manual",
  };
  (init.headers as Headers).set("host", "24six.app");
  (init.headers as Headers).delete("accept-encoding");
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return new Response("24six is unreachable from the proxy.", { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  headers.delete("x-frame-options");
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  headers.delete("content-encoding");
  headers.delete("content-length");

  const ct = upstream.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    let html = await upstream.text();
    // make relative URLs resolve back to 24six.app so assets still load
    if (!/<base /i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="https://24six.app/">`);
    }
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: upstream.status, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
};

export const config = { path: ["/24six", "/24six/*"] };
