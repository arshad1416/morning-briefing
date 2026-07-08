const ALLOWED_ORIGINS = [
  'https://briefing.arshadkazi.ca',
  /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.morningbriefing\.pages\.dev$/,
];
export function getOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return 'https://briefing.arshadkazi.ca';
  if (ALLOWED_ORIGINS.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))) return origin;
  return 'https://briefing.arshadkazi.ca';
}
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}
export function randomId() {
  return crypto.randomUUID();
}
