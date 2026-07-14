// app/login/login-client.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AuthShell,
  Field,
  FormError,
  PrimaryButton,
  GhostButton,
  Divider,
  GoogleIcon,
  PasskeyIcon,
} from '@/components/auth/AuthShell';
import { login, googleStartUrl, passkeyLoginOptions, passkeyLoginVerify } from '@/lib/auth/api';
import { errorMessage } from '@/lib/auth/errors';
import { loadWebAuthn } from '@/lib/auth/webauthn';
import { useMe, useRefreshMe } from '@/lib/auth/useMe';

export function LoginClient() {
  const router = useRouter();
  const { data: me } = useMe();
  const refreshMe = useRefreshMe();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // OAuth error redirects arrive as ?error=use_password (search params read in an
  // effect — static export renders this page without request context).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(errorMessage(code));
  }, []);

  // Already signed in → account.
  useEffect(() => {
    if (me) router.replace('/account/');
  }, [me, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (res.ok) {
      refreshMe();
      router.push('/dashboard/');
    } else {
      setError(errorMessage(res.body.error));
    }
  }

  async function onPasskey() {
    setBusy(true);
    setError(null);
    try {
      const webauthn = await loadWebAuthn();
      const opts = await passkeyLoginOptions(email.trim() || undefined);
      if (!opts.ok || !opts.body.challengeId) throw new Error(opts.body.error || 'verify_failed');
      const { challengeId, ...optionsJSON } = opts.body;
      const assertion = await webauthn.startAuthentication({ optionsJSON });
      const verify = await passkeyLoginVerify(challengeId, assertion.id, assertion);
      if (!verify.ok) throw new Error(verify.body.error || 'verify_failed');
      refreshMe();
      router.push('/dashboard/');
    } catch (err) {
      // NotAllowedError = user dismissed the browser prompt; stay quiet-ish
      const code = err instanceof Error ? err.message : undefined;
      if (code !== 'NotAllowedError') setError(errorMessage(code, 'Passkey sign-in failed — please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to the desk.">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError>{error}</FormError>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••••" />
        <PrimaryButton busy={busy}>Sign in</PrimaryButton>
      </form>

      <div className="mt-5 space-y-3">
        <Divider>or</Divider>
        <GhostButton onClick={() => (window.location.href = googleStartUrl(false))} busy={busy}>
          <GoogleIcon /> Continue with Google
        </GhostButton>
        <GhostButton onClick={onPasskey} busy={busy}>
          <PasskeyIcon /> Sign in with a passkey
        </GhostButton>
      </div>

      <p className="mt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">
        New here?{' '}
        <Link href="/signup/" className="font-medium underline" style={{ color: 'var(--color-accent)' }}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
