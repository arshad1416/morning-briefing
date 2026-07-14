// components/auth/AuthShell.tsx — standalone auth page chrome + form primitives
'use client';

import React from 'react';
import Link from 'next/link';
import { GammaMark } from '@/components/brand/GammaMark';

export function AuthShell({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--color-bg-base)]">
      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,122,26,0.10), rgba(255,122,26,0) 70%)' }}
        />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <GammaMark size={30} />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Maple<span style={{ color: 'var(--color-accent)' }}>Gamma</span>
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-4xl tracking-tight text-[var(--color-text-primary)]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">{subtitle}</p>}
          <div
            className="mt-6 rounded-2xl border p-6 sm:p-8"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-surface)',
              boxShadow: 'var(--shadow-tile)',
            }}
          >
            {children}
          </div>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
            By continuing you agree to the{' '}
            <a href="/terms.html" className="underline hover:text-[var(--color-text-secondary)]">Terms</a> and{' '}
            <a href="/privacy.html" className="underline hover:text-[var(--color-text-secondary)]">Privacy Policy</a>.
            Not investment advice.
          </p>
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required
        className="w-full rounded-lg border bg-[var(--color-bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-accent)]"
        style={{ borderColor: 'var(--color-border-default)' }}
      />
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-text-tertiary)]">{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[var(--color-text-secondary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span>{children}</span>
    </label>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border px-3 py-2 text-[13px]"
      style={{
        color: 'var(--color-bear)',
        backgroundColor: 'var(--color-bear-soft)',
        borderColor: 'color-mix(in srgb, var(--color-bear) 25%, transparent)',
      }}
    >
      {children}
    </p>
  );
}

export function FormNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="rounded-lg border px-3 py-2 text-[13px]"
      style={{
        color: 'var(--color-bull)',
        backgroundColor: 'var(--color-bull-soft)',
        borderColor: 'color-mix(in srgb, var(--color-bull) 25%, transparent)',
      }}
    >
      {children}
    </p>
  );
}

export function PrimaryButton({
  children,
  busy,
  type = 'submit',
  onClick,
}: {
  children: React.ReactNode;
  busy?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className="inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--color-accent-fg)] disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: 'var(--color-border-default)' }}
    >
      {children}
    </button>
  );
}

export function Divider({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
      <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
      {children}
      <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.63l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

export function PasskeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="8" r="4" />
      <path d="M3.5 20.5c0-3.6 2.9-6.5 6.5-6.5 1.2 0 2.4.34 3.4.93" />
      <circle cx="17.5" cy="14.5" r="2.5" />
      <path d="M17.5 17v4l1.5-1.2L20.5 21v-4" />
    </svg>
  );
}
