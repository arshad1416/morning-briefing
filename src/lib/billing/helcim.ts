// lib/billing/helcim.ts — HelcimPay.js embedded checkout modal.
// Port of the legacy paywall flow: load start.js, append the iframe for a
// checkoutToken, resolve with the SUCCESS payload (which the caller POSTs to
// /api/billing/confirm), or reject on abort/close. Unlike the legacy flow
// (which full-page-reloaded after confirm), the SPA must tear the iframe
// down itself on every terminal event.
'use client';

declare global {
  interface Window {
    appendHelcimPayIframe?: (checkoutToken: string) => void;
    removeHelcimPayIframe?: () => void;
  }
}

const HELCIM_SRC = 'https://secure.helcim.app/helcim-pay/services/start.js';

// The Worker's billing session expires after 30 min; give the user most of
// that to finish card entry before we give up and unstick the UI.
const CHECKOUT_TIMEOUT_MS = 25 * 60 * 1000;

let helcimLoader: Promise<void> | null = null;

function loadHelcim(): Promise<void> {
  if (typeof window !== 'undefined' && window.appendHelcimPayIframe) return Promise.resolve();
  if (!helcimLoader) {
    helcimLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HELCIM_SRC;
      s.onload = () => resolve();
      s.onerror = () => {
        helcimLoader = null;
        reject(new Error('helcim_load_failed'));
      };
      document.head.appendChild(s);
    });
  }
  return helcimLoader;
}

/** Opens the HelcimPay modal. Resolves with the SUCCESS event payload
 *  (parsed if it arrived as a JSON string); rejects with Error('checkout_aborted')
 *  when the user closes the modal or nothing ever responds. The iframe is
 *  removed on every outcome. */
export async function openHelcimCheckout(checkoutToken: string): Promise<unknown> {
  await loadHelcim();
  return new Promise((resolve, reject) => {
    if (!window.appendHelcimPayIframe) {
      reject(new Error('helcim_load_failed'));
      return;
    }
    const eventName = `helcim-pay-js-${checkoutToken}`;

    const cleanup = () => {
      window.removeEventListener('message', handler);
      window.clearTimeout(timer);
      try {
        window.removeHelcimPayIframe?.();
      } catch {
        // iframe already gone — nothing to do
      }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('checkout_aborted'));
    }, CHECKOUT_TIMEOUT_MS);

    const handler = (event: MessageEvent) => {
      const data = event.data as { eventName?: string; eventStatus?: string; eventMessage?: unknown } | undefined;
      if (!data || data.eventName !== eventName) return;
      if (data.eventStatus === 'ABORTED' || data.eventStatus === 'HIDE') {
        cleanup();
        reject(new Error('checkout_aborted'));
        return;
      }
      if (data.eventStatus === 'SUCCESS') {
        cleanup();
        let payload = data.eventMessage;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            // leave as string; the Worker tolerates both envelopes
          }
        }
        resolve(payload);
      }
    };

    window.addEventListener('message', handler);
    window.appendHelcimPayIframe(checkoutToken);
  });
}
