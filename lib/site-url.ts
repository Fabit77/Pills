export function getSiteUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}
