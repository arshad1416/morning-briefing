import { describe, it, expect } from 'vitest';
import { validateConsent } from '../src/legal.js';

const env = { TERMS_VERSION: '2026-07-08', ACK_VERSION: '2026-07-08' };

describe('legal', () => {
  it('accepts a full, non-Quebec consent', () => {
    const r = validateConsent({ acceptTerms: true, acceptAck: true, notQuebec: true }, env);
    expect(r.ok).toBe(true);
    expect(r.consent.quebecAttested).toBe(true);
  });
  it('blocks a Quebec resident', () => {
    const r = validateConsent({ acceptTerms: true, acceptAck: true, notQuebec: false }, env);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('quebec_not_available');
  });
  it('requires terms + ack', () => {
    expect(validateConsent({ acceptTerms: false, acceptAck: true, notQuebec: true }, env).ok).toBe(false);
    expect(validateConsent({ acceptTerms: true, acceptAck: false, notQuebec: true }, env).ok).toBe(false);
  });
});
