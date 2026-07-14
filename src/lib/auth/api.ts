// lib/auth/api.ts — client for the Cloudflare Worker auth/billing API.
// The Worker owns maplegamma.com/api/*, so every call is same-origin; the
// session is an HttpOnly mg_session cookie carried by credentials: 'include'.

export interface Entitlement {
  entitled: boolean;
  tier: 'trial' | 'basic' | 'pro' | null;
  status: 'active' | 'canceled' | 'past_due' | 'expired' | 'none';
  trialEndsAt?: number;
  periodEnd?: number;
  billingInterval?: 'monthly' | 'annual';
}

export interface Me {
  id: string;
  email: string;
  briefingOptIn: boolean;
  entitlement: Entitlement;
}

export interface SignupPayload {
  email: string;
  password: string;
  acceptTerms: boolean;
  acceptAck: boolean;
  notQuebec: boolean;
  briefingOptIn: boolean;
}

export type BillingTier = 'basic' | 'pro';
export type BillingInterval = 'monthly' | 'annual';

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  body: T & { error?: string };
}

async function post<T = Record<string, unknown>>(path: string, payload?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let body = {} as ApiResult<T>['body'];
  try {
    body = await res.json();
  } catch {
    // non-JSON error responses (e.g. 404 HTML on local preview) — leave body empty
  }
  return { ok: res.ok, status: res.status, body };
}

/** null = signed out (or API unreachable, e.g. local preview without the Worker). */
export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export const login = (email: string, password: string) => post('/api/auth/login', { email, password });
export const signup = (payload: SignupPayload) => post('/api/auth/signup', payload);
export const logout = () => post('/api/auth/logout');
export const setBriefingOptIn = (optIn: boolean) =>
  post<{ ok?: boolean; briefingOptIn?: boolean }>('/api/account/briefing', { optIn });

// ---- Billing (HelcimPay two-step: checkout → embedded modal → confirm) ----
export const billingCheckout = (tier: BillingTier, interval: BillingInterval) =>
  post<{ checkoutToken?: string; mock?: boolean; tier?: string; interval?: string }>('/api/billing/checkout', {
    tier,
    interval,
  });
export const billingConfirm = (payload: unknown) => post('/api/billing/confirm', payload);
export const billingCancel = () => post('/api/billing/cancel');

// ---- Passkeys (SimpleWebAuthn v11 contract; server issues a challengeId) ----
type PasskeyOptions = Record<string, unknown> & { challengeId?: string };
export const passkeyRegisterOptions = () => post<PasskeyOptions>('/api/auth/passkey/register/options');
export const passkeyRegisterVerify = (challengeId: string, response: unknown) =>
  post('/api/auth/passkey/register/verify', { challengeId, response });
export const passkeyLoginOptions = (email?: string) =>
  post<PasskeyOptions>('/api/auth/passkey/login/options', { email: email || undefined });
export const passkeyLoginVerify = (challengeId: string, credentialId: string, response: unknown) =>
  post('/api/auth/passkey/login/verify', { challengeId, credentialId, response });

/** Google OAuth is a full-page redirect; consent=true only from the signup page
 *  (attests the consent checkboxes were ticked — the Worker requires it for new users). */
export function googleStartUrl(consent: boolean): string {
  return `/api/auth/oauth/google/start${consent ? '?c=1' : ''}`;
}
