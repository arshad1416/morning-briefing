// app/signup/signup-client.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AuthShell,
  Field,
  CheckboxField,
  FormError,
  PrimaryButton,
  GhostButton,
  Divider,
  GoogleIcon,
} from '@/components/auth/AuthShell';
import { signup, googleStartUrl, type BillingTier, type BillingInterval } from '@/lib/auth/api';
import { errorMessage } from '@/lib/auth/errors';
import { useMe, useRefreshMe } from '@/lib/auth/useMe';

function parsePlan(search: string): { plan?: BillingTier; interval: BillingInterval } {
  const params = new URLSearchParams(search);
  const plan = params.get('plan');
  const interval = params.get('interval') === 'annual' ? 'annual' : 'monthly';
  return { plan: plan === 'basic' || plan === 'pro' ? plan : undefined, interval };
}

export function SignupClient() {
  const router = useRouter();
  const { data: me } = useMe();
  const refreshMe = useRefreshMe();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAck, setAcceptAck] = useState(false);
  const [notQuebec, setNotQuebec] = useState(false);
  const [briefingOptIn, setBriefingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<BillingTier | undefined>(undefined);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  // Set once we navigate after a successful signup, so the already-signed-in
  // effect below can't race the session refetch and override the destination.
  const navigated = React.useRef(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(errorMessage(code));
    const parsed = parsePlan(window.location.search);
    setPlan(parsed.plan);
    setInterval(parsed.interval);
  }, []);

  // Already signed in → account (carrying an intended plan into checkout).
  useEffect(() => {
    if (me && !navigated.current) {
      router.replace(plan ? `/account/?checkout=${plan}&interval=${interval}` : '/account/');
    }
  }, [me, router, plan, interval]);

  const consentOk = acceptTerms && acceptAck && notQuebec;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consentOk) {
      setError(errorMessage('consent_required'));
      return;
    }
    if (password.length < 10) {
      setError(errorMessage('weak_password'));
      return;
    }
    setBusy(true);
    const res = await signup({ email: email.trim(), password, acceptTerms, acceptAck, notQuebec, briefingOptIn });
    setBusy(false);
    if (res.ok) {
      navigated.current = true;
      refreshMe();
      router.push(plan ? `/account/?checkout=${plan}&interval=${interval}` : '/dashboard/');
    } else {
      setError(errorMessage(res.body.error));
    }
  }

  function onGoogle() {
    if (!consentOk) {
      setError(errorMessage('consent'));
      return;
    }
    window.location.href = googleStartUrl(true);
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        plan
          ? `Start your 7-day free trial of ${plan === 'pro' ? 'Pro' : 'Basic'} — no card required to sign up.`
          : // "The full desk" named nothing the reader would later be shown; the
            // trial concretely grants Pro-tier access, which is one of the two
            // plans on the next screen.
            'Every account starts with a 7-day free trial of Pro — every feature, no card required to sign up.'
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError>{error}</FormError>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="••••••••••"
          minLength={10}
          hint="At least 10 characters."
        />

        <div className="space-y-2.5 pt-1">
          <CheckboxField checked={acceptTerms} onChange={setAcceptTerms}>
            I accept the{' '}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline">
              Privacy Policy
            </a>
            .
          </CheckboxField>
          <CheckboxField checked={acceptAck} onChange={setAcceptAck}>
            I understand MapleGamma provides general market information — not investment advice or recommendations.
          </CheckboxField>
          <CheckboxField checked={notQuebec} onChange={setNotQuebec}>
            I am not a resident of Quebec.
          </CheckboxField>
          <CheckboxField checked={briefingOptIn} onChange={setBriefingOptIn}>
            Email me the Morning Briefing (optional — unsubscribe anytime).
          </CheckboxField>
        </div>

        <PrimaryButton busy={busy}>Create account</PrimaryButton>
      </form>

      <div className="mt-5 space-y-3">
        <Divider>or</Divider>
        <GhostButton onClick={onGoogle} busy={busy}>
          <GoogleIcon /> Continue with Google
        </GhostButton>
      </div>

      <p className="mt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">
        Already have an account?{' '}
        <Link href="/login/" className="font-medium underline" style={{ color: 'var(--color-accent)' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
