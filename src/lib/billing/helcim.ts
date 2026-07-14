// lib/billing/helcim.ts — HelcimPay.js embedded checkout modal.
// Faithful port of the legacy paywall flow: load start.js, append the iframe
// for a checkoutToken, resolve with the SUCCESS payload (which the caller
// POSTs to /api/billing/confirm), or reject on abort/close.
'use client';

declare global {
  interface Window {
    appendHelcimPayIframe?: (checkoutToken: string) => void;
    removeHelcimPayIframe?: () => void;
  }
}

const HELCIM_SRC = 'https://secure.helcim.app/helcim-pay/services/start.js';

function loadHelcim(): Promise<void> {
  if (typeof window !== 'undefined' && window.appendHelcimPayIframe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = HELCIM_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('helcim_load_failed'));
    document.head.appendChild(s);
  });
}

/** Opens the HelcimPay modal. Resolves with the SUCCESS event payload
 *  (parsed if it arrived as a JSON string); rejects with Error('checkout_aborted')
 *  when the user closes the modal. */
export async function openHelcimCheckout(checkoutToken: string): Promise<unknown> {
  await loadHelcim();
  return new Promise((resolve, reject) => {
    const eventName = `helcim-pay-js-${checkoutToken}`;
    const handler = (event: MessageEvent) => {
      const data = event.data as { eventName?: string; eventStatus?: string; eventMessage?: unknown } | undefined;
      if (!data || data.eventName !== eventName) return;
      if (data.eventStatus === 'ABORTED' || data.eventStatus === 'HIDE') {
        window.removeEventListener('message', handler);
        reject(new Error('checkout_aborted'));
        return;
      }
      if (data.eventStatus === 'SUCCESS') {
        window.removeEventListener('message', handler);
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
    window.appendHelcimPayIframe?.(checkoutToken);
  });
}
