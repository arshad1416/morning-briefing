export function validateConsent(body, env) {
  if (!body?.acceptTerms || !body?.acceptAck) {
    return { ok: false, error: 'consent_required' };
  }
  if (!body?.notQuebec) {
    return { ok: false, error: 'quebec_not_available' };
  }
  return {
    ok: true,
    consent: {
      termsVersion: env.TERMS_VERSION,
      ackVersion: env.ACK_VERSION,
      quebecAttested: true,
    },
  };
}
