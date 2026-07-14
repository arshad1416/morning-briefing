// lib/auth/webauthn.ts — lazy loader for the vendored SimpleWebAuthn browser
// bundle (served same-origin from /vendor/ because the CSP forbids CDNs).
'use client';

export interface WebAuthnBrowser {
  startRegistration: (opts: { optionsJSON: unknown }) => Promise<{ id: string } & Record<string, unknown>>;
  startAuthentication: (opts: { optionsJSON: unknown }) => Promise<{ id: string } & Record<string, unknown>>;
  browserSupportsWebAuthn?: () => boolean;
}

declare global {
  interface Window {
    SimpleWebAuthnBrowser?: WebAuthnBrowser;
  }
}

const SRC = '/vendor/simplewebauthn-browser.umd.min.js';
let loader: Promise<WebAuthnBrowser> | null = null;

export function loadWebAuthn(): Promise<WebAuthnBrowser> {
  if (typeof window !== 'undefined' && window.SimpleWebAuthnBrowser) {
    return Promise.resolve(window.SimpleWebAuthnBrowser);
  }
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.onload = () =>
        window.SimpleWebAuthnBrowser
          ? resolve(window.SimpleWebAuthnBrowser)
          : reject(new Error('webauthn_load_failed'));
      s.onerror = () => {
        loader = null;
        reject(new Error('webauthn_load_failed'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}
