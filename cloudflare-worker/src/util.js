// maplegamma.com is canonical; the other live domains are allowed during the
// 301-redirect transition so chat/feedback/api aren't CORS-blocked on them.
const CANONICAL_ORIGIN = 'https://maplegamma.com';
const ALLOWED_ORIGINS = [
  'https://maplegamma.com',
  'https://maplegamma.ca',
  'https://maplegamma.arshadkazi.ca',
  'https://briefing.arshadkazi.ca',
  /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.morningbriefing\.pages\.dev$/,
];
export function getOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return CANONICAL_ORIGIN;
  if (ALLOWED_ORIGINS.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))) return origin;
  return CANONICAL_ORIGIN;
}
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}
export function randomId() {
  return crypto.randomUUID();
}
