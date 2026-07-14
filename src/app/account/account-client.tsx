// app/account/account-client.tsx — signed-in hub: profile, subscription, security
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Surface, SurfaceHeader } from '@/components/primitives';
import { FormError, FormNote, GhostButton, PasskeyIcon } from '@/components/auth/AuthShell';
import {
  logout,
  billingCheckout,
  billingConfirm,
  billingCancel,
  setBriefingOptIn,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyCredentials,
  passkeyCredentialDelete,
  type BillingTier,
  type BillingInterval,
  type Entitlement,
  type PasskeyCredential,
} from '@/lib/auth/api';
import { errorMessage } from '@/lib/auth/errors';
import { openHelcimCheckout } from '@/lib/billing/helcim';
import { loadWebAuthn } from '@/lib/auth/webauthn';
import { useMe, useRefreshMe } from '@/lib/auth/useMe';

const PLANS: { tier: BillingTier; name: string; monthly: number; blurb: string }[] = [
  { tier: 'basic', name: 'Basic', monthly: 49, blurb: 'Screener, research, sentiment.' },
  { tier: 'pro', name: 'Pro', monthly: 99, blurb: 'Everything in Basic, plus charts, models & the AI council.' },
];

function fmtDate(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Human label for a credential's transport hints. */
function passkeyKindLabel(transports: string[]) {
  if (transports.includes('internal')) return 'This device';
  if (transports.includes('hybrid')) return 'Phone or tablet';
  if (transports.some((t) => ['usb', 'nfc', 'ble'].includes(t))) return 'Security key';
  return 'Passkey';
}

function daysLeft(ms?: number) {
  if (!ms) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / 86_400_000));
}

function SubscriptionSummary({ ent }: { ent: Entitlement }) {
  const chip = (label: string, color: string) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {label}
    </span>
  );

  if (ent.tier === 'trial' && ent.status === 'active') {
    return (
      <div className="space-y-1">
        {chip(`Free trial — ${daysLeft(ent.trialEndsAt)} days left`, 'var(--color-accent)')}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Full Pro access until {fmtDate(ent.trialEndsAt)}. Pick a plan below to keep it.
        </p>
      </div>
    );
  }
  if (ent.tier === 'trial') {
    return (
      <div className="space-y-1">
        {chip('Trial ended', 'var(--color-caution)')}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your free trial ended {fmtDate(ent.trialEndsAt)}. Pick a plan below to get back in.
        </p>
      </div>
    );
  }
  if ((ent.tier === 'basic' || ent.tier === 'pro') && ent.status === 'active') {
    const plan = PLANS.find((p) => p.tier === ent.tier)!;
    const price = ent.billingInterval === 'annual' ? `$${plan.monthly * 10}/yr` : `$${plan.monthly}/mo`;
    return (
      <div className="space-y-1">
        {chip(`${plan.name} — ${price} CAD`, 'var(--color-bull)')}
        <p className="text-sm text-[var(--color-text-secondary)]">
          {ent.periodEnd ? `Renews on ${fmtDate(ent.periodEnd)}.` : `Renews ${ent.billingInterval === 'annual' ? 'annually' : 'monthly'}.`}
        </p>
      </div>
    );
  }
  if (ent.status === 'canceled') {
    return (
      <div className="space-y-1">
        {chip('Canceled', 'var(--color-caution)')}
        <p className="text-sm text-[var(--color-text-secondary)]">
          {ent.periodEnd
            ? `Access continues until ${fmtDate(ent.periodEnd)}. Resubscribe below anytime.`
            : 'Subscription canceled — choose a plan below to resume.'}
        </p>
      </div>
    );
  }
  if (ent.status === 'past_due') {
    return (
      <div className="space-y-1">
        {chip('Payment issue', 'var(--color-bear)')}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your last renewal failed. Restart checkout below to update your card.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {chip('No active plan', 'var(--color-neutral)')}
      <p className="text-sm text-[var(--color-text-secondary)]">Pick a plan below to unlock the full desk.</p>
    </div>
  );
}

export function AccountClient() {
  const router = useRouter();
  const { data: me, isLoading, isFetching } = useMe();
  const refreshMe = useRefreshMe();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const autoCheckoutDone = useRef(false);

  // Registered passkeys (null until the first load resolves).
  const [passkeys, setPasskeys] = useState<PasskeyCredential[] | null>(null);
  const loadPasskeys = useCallback(async () => {
    const res = await passkeyCredentials();
    if (res.ok && Array.isArray(res.body.credentials)) setPasskeys(res.body.credentials);
  }, []);
  useEffect(() => {
    if (me) loadPasskeys();
  }, [me, loadPasskeys]);

  const startCheckout = useCallback(
    async (tier: BillingTier, chosenInterval: BillingInterval) => {
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        const res = await billingCheckout(tier, chosenInterval);
        if (res.status === 401) {
          router.push('/login/');
          return;
        }
        if (!res.ok) {
          setError(errorMessage(res.body.error));
          return;
        }
        if (res.body.mock) {
          refreshMe();
          setNote('Subscription activated.');
          return;
        }
        if (!res.body.checkoutToken) {
          setError(errorMessage(undefined));
          return;
        }
        const payload = await openHelcimCheckout(res.body.checkoutToken);
        const confirm = await billingConfirm(payload);
        if (confirm.ok) {
          refreshMe();
          setNote('Subscription active — welcome aboard.');
        } else {
          setError(errorMessage(confirm.body.error, 'Could not activate the subscription.'));
        }
      } catch (err) {
        if (!(err instanceof Error && err.message === 'checkout_aborted')) {
          setError(errorMessage(err instanceof Error ? err.message : undefined));
        }
      } finally {
        setBusy(false);
      }
    },
    [refreshMe, router],
  );

  // Signed out → login. Wait for any in-flight session refetch too: right
  // after signup the cache can briefly hold a stale signed-out `null` while
  // /api/auth/me re-resolves — redirecting on it would drop the ?checkout plan.
  useEffect(() => {
    if (!isLoading && !isFetching && !me) router.replace('/login/');
  }, [isLoading, isFetching, me, router]);

  // ?checkout=basic|pro&interval=... (arriving from signup with a chosen plan).
  // Strip the params immediately so a reload or bookmark can never re-trigger
  // checkout, and skip entirely when a paid plan is already active.
  useEffect(() => {
    if (!me || autoCheckoutDone.current) return;
    const params = new URLSearchParams(window.location.search);
    const tier = params.get('checkout');
    if (tier !== 'basic' && tier !== 'pro') return;
    autoCheckoutDone.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    const ent = me.entitlement;
    if ((ent.tier === 'basic' || ent.tier === 'pro') && ent.status === 'active') return;
    const chosen = params.get('interval') === 'annual' ? 'annual' : 'monthly';
    setInterval(chosen);
    startCheckout(tier, chosen);
  }, [me, startCheckout]);

  if (isLoading || !me) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40" />
        <div className="skeleton h-56" />
      </div>
    );
  }

  const ent = me.entitlement;
  const onPaidActivePlan = (ent.tier === 'basic' || ent.tier === 'pro') && ent.status === 'active';

  async function onLogout() {
    await logout();
    refreshMe();
    router.push('/');
  }

  async function onCancel() {
    // Only promise access-until-period-end when we actually know the period
    // end — the Worker keeps canceled subs entitled through periodEnd, but a
    // row without one is locked out immediately.
    const untilCopy = ent.periodEnd ? 'You keep access until the end of the paid period.' : 'Access ends immediately.';
    if (!window.confirm(`Cancel your subscription? ${untilCopy}`)) return;
    setBusy(true);
    setError(null);
    const res = await billingCancel();
    setBusy(false);
    if (res.ok) {
      refreshMe();
      setNote(ent.periodEnd ? 'Subscription canceled — access continues until the period ends.' : 'Subscription canceled.');
    } else {
      setError(errorMessage(res.body.error));
    }
  }

  async function onAddPasskey() {
    setBusy(true);
    setError(null);
    try {
      const webauthn = await loadWebAuthn();
      const opts = await passkeyRegisterOptions();
      if (!opts.ok || !opts.body.challengeId) throw new Error(opts.body.error || 'verify_failed');
      const { challengeId, ...optionsJSON } = opts.body;
      const attestation = await webauthn.startRegistration({ optionsJSON });
      const verify = await passkeyRegisterVerify(challengeId, attestation);
      if (!verify.ok) throw new Error(verify.body.error || 'verify_failed');
      setNote('Passkey added — you can now sign in without a password.');
      loadPasskeys();
    } catch (err) {
      // DOMException carries the signal in .name, not .message.
      if (err instanceof Error && err.name === 'InvalidStateError') {
        // The server's excludeCredentials matched this authenticator: the
        // passkey is ALREADY registered — success state, not a failure.
        setNote('This device already has a passkey for your account — you can sign in with it.');
        loadPasskeys();
      } else if (!(err instanceof Error && err.name === 'NotAllowedError')) {
        setError(errorMessage(err instanceof Error ? err.message : undefined, 'Could not add the passkey.'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRemovePasskey(credentialId: string) {
    if (!window.confirm('Remove this passkey? You can add it back anytime from the same device.')) return;
    setError(null);
    setNote(null);
    const res = await passkeyCredentialDelete(credentialId);
    if (res.ok) {
      setNote('Passkey removed.');
      loadPasskeys();
    } else {
      setError(errorMessage(res.body.error, 'Could not remove the passkey.'));
    }
  }

  async function onBriefingToggle(optIn: boolean) {
    const res = await setBriefingOptIn(optIn);
    if (res.ok) refreshMe();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="pt-1 pb-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{me.email}</h1>
      </header>

      {error && <FormError>{error}</FormError>}
      {note && <FormNote>{note}</FormNote>}

      {/* Subscription */}
      <Surface span="hero" className="!min-h-0">
        <SurfaceHeader title="Subscription" />
        <div className="space-y-5 p-5">
          <SubscriptionSummary ent={ent} />

          {onPaidActivePlan ? (
            <div className="flex flex-wrap gap-3">
              {ent.tier === 'basic' && (
                <button
                  onClick={() => startCheckout('pro', ent.billingInterval ?? 'monthly')}
                  disabled={busy}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-[var(--color-accent-fg)] disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
                >
                  Upgrade to Pro
                </button>
              )}
              <button
                onClick={onCancel}
                disabled={busy}
                className="rounded-xl border px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-bear)] disabled:opacity-60"
                style={{ borderColor: 'var(--color-border-default)' }}
              >
                Cancel subscription
              </button>
            </div>
          ) : (
            <div>
              {/* Interval toggle */}
              <div className="mb-4 inline-flex rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)] p-0.5">
                {(['monthly', 'annual'] as const).map((i) => (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: interval === i ? 'var(--color-bg-overlay)' : 'transparent',
                      color: interval === i ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                    }}
                  >
                    {i === 'monthly' ? 'Monthly' : 'Annual — 2 months free'}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {PLANS.map((p) => (
                  <div
                    key={p.tier}
                    className="flex flex-col rounded-xl border p-4"
                    style={{
                      borderColor: p.tier === 'pro' ? 'rgba(255,122,26,0.35)' : 'var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-elevated)',
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      {p.name}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]" data-numeric>
                      {interval === 'annual' ? `$${p.monthly * 10}` : `$${p.monthly}`}
                      <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
                        / {interval === 'annual' ? 'year' : 'month'} CAD
                      </span>
                    </p>
                    <p className="mt-1 flex-1 text-xs text-[var(--color-text-tertiary)]">{p.blurb}</p>
                    <button
                      onClick={() => startCheckout(p.tier, interval)}
                      disabled={busy}
                      className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition hover:bg-[var(--color-accent-fg)] disabled:opacity-60"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
                    >
                      {busy ? 'Working…' : ent.status === 'past_due' || ent.status === 'canceled' ? `Resubscribe to ${p.name}` : `Choose ${p.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Surface>

      {/* Security */}
      <Surface span="hero" className="!min-h-0">
        <SurfaceHeader title="Security" />
        <div className="p-5">
          {passkeys && passkeys.length > 0 && (
            <ul className="mb-4 divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {passkeys.map((pk) => (
                <li key={pk.credentialId} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                  <span className="flex items-center gap-3 text-sm text-[var(--color-text-primary)]">
                    <PasskeyIcon />
                    <span>
                      {passkeyKindLabel(pk.transports)}
                      <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">Added {fmtDate(pk.createdAt)}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemovePasskey(pk.credentialId)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-bear)]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
              {passkeys && passkeys.length > 0
                ? 'Add another passkey from a different device anytime.'
                : 'Add a passkey to sign in with Face ID, Touch ID, or a security key — no password needed.'}
            </p>
            <div className="w-48">
              <GhostButton onClick={onAddPasskey} busy={busy}>
                <PasskeyIcon /> Add a passkey
              </GhostButton>
            </div>
          </div>
        </div>
      </Surface>

      {/* Preferences */}
      <Surface span="hero" className="!min-h-0">
        <SurfaceHeader title="Preferences" />
        <div className="space-y-4 p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Email me the Morning Briefing each trading day.
            </span>
            <input
              type="checkbox"
              checked={me.briefingOptIn}
              onChange={(e) => onBriefingToggle(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
          </label>
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-[var(--color-text-tertiary)] underline transition hover:text-[var(--color-bear)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
