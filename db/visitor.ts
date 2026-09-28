const COOKIE_NAME = "daymark_demo_visitor";
const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function visitorId(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return value && visitorPattern.test(value) ? value : null;
}

export function sessionResponse(request: Request): Response {
  const current = visitorId(request);
  if (current) return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  const id = crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${COOKIE_NAME}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}` } });
}
