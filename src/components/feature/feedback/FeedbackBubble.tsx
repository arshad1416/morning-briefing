// components/feature/feedback/FeedbackBubble.tsx — floating feedback pill on
// every page, ported from the legacy feedback.js (CompCeiling-style).
// Collapsed pill → compact form (general/feature/bug + message + optional
// email). POSTs to the chat Worker's /feedback route, which forwards to
// Telegram — no backend on the static site itself.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const ENDPOINT = 'https://morning-briefing-chat.rcobwq7u.workers.dev/feedback';

type FbType = 'general' | 'feature' | 'bug';
const TYPES: { key: FbType; label: string }[] = [
  { key: 'general', label: '💬 General' },
  { key: 'feature', label: '✨ Feature' },
  { key: 'bug', label: '🐞 Bug' },
];

export function FeedbackBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FbType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const isAuthPage = normalizedPath === '/login' || normalizedPath === '/signup';
  const hasAppNavigation = normalizedPath !== '/';

  useEffect(() => {
    setOpen(false);
    setStatus(null);
  }, [normalizedPath]);

  useEffect(() => {
    if (!open) return;

    dialogRef.current?.querySelector<HTMLElement>('[data-feedback-autofocus]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('[data-feedback-trigger]')?.focus();
      });
    };
  }, [open]);

  if (isAuthPage) return null;

  const send = async () => {
    if (sending) return;
    const msg = message.trim();
    const mail = email.trim();
    if (msg.length < 3) {
      setStatus({ ok: false, text: 'Please add a little more detail.' });
      return;
    }
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setStatus({ ok: false, text: 'That email doesn’t look right.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: msg,
          email: mail || null,
          page: pathname || '/',
          ua: navigator.userAgent.slice(0, 200),
        }),
      });
      if (res.ok) {
        setStatus({ ok: true, text: '✅ Thanks — got it.' });
        setMessage('');
        setEmail('');
        setTimeout(() => {
          setOpen(false);
          setStatus(null);
        }, 1400);
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({
          ok: false,
          text: j.error === 'rate_limited' ? 'You’ve sent a few already — try again later.' : 'Couldn’t send just now. Please try again.',
        });
      }
    } catch {
      setStatus({ ok: false, text: 'Network error — please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`fixed right-[max(1rem,env(safe-area-inset-right))] z-50 md:right-5 ${
        hasAppNavigation
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-5'
      }`}
    >
      {open ? (
        <div
          id="feedback-dialog"
          ref={dialogRef}
          role="dialog"
          aria-labelledby="feedback-dialog-title"
          className="w-80 max-w-[calc(100vw-32px)] rounded-2xl border p-4 shadow-2xl"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="feedback-dialog-title" className="text-sm font-semibold text-[var(--color-text-primary)]">Feedback form</h2>
            <button
              type="button"
              data-feedback-autofocus
              onClick={() => setOpen(false)}
              aria-label="Close feedback form"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-xl leading-none text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              ×
            </button>
          </div>
          <div className="mb-2.5 flex gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className="min-h-11 flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={
                  type === t.key
                    ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-text-primary)' }
                    : { borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind? Bugs, ideas, anything…"
            className="mb-2.5 w-full resize-y rounded-lg border px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}
          />
          <input
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional, if you'd like a reply)"
            className="mb-2.5 w-full rounded-lg border px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}
          />
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="min-h-11 w-full rounded-lg py-2.5 text-sm font-semibold transition hover:bg-[var(--color-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <p
            aria-live="polite"
            className="mt-2 min-h-[18px] text-xs"
            style={{ color: status ? (status.ok ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}
          >
            {status?.text}
          </p>
        </div>
      ) : (
        <button
          data-feedback-trigger
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          aria-haspopup="dialog"
          title="Send feedback"
          className="flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
        >
          <span aria-hidden="true">✍</span>
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}
    </div>
  );
}
