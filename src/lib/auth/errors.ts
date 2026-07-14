// lib/auth/errors.ts — Worker error codes → human copy

const MESSAGES: Record<string, string> = {
  // auth
  invalid_email: "That email address doesn't look right.",
  weak_password: 'Password must be at least 10 characters.',
  consent_required: 'Please accept the Terms and risk acknowledgment to continue.',
  quebec_not_available: 'MapleGamma is not available to residents of Quebec.',
  email_taken: 'An account with this email already exists — try signing in instead.',
  invalid_credentials: 'Incorrect email or password.',
  too_many_attempts: 'Too many attempts — please wait 15 minutes and try again.',
  not_signed_in: 'You need to sign in first.',
  // OAuth redirect errors (arrive as ?error= on /login and /signup)
  use_password: 'This email uses password sign-in. Enter your password below.',
  consent: 'Please accept the required checkboxes before continuing with Google.',
  // passkeys
  bad_challenge: 'Passkey challenge expired — please try again.',
  unknown_credential: 'That passkey is not registered here.',
  verify_failed: 'Passkey verification failed — please try again.',
  not_verified: 'Passkey verification failed — please try again.',
  webauthn_load_failed: 'Passkeys are unavailable right now.',
  // billing
  invalid_plan: 'That plan is not available.',
  plan_not_configured: 'Checkout is not available right now — please try again later.',
  helcim_init_failed: 'Payment provider error — please try again.',
  subscription_failed: 'Payment provider error — please try again.',
  no_checkout: 'Checkout session expired — please start again.',
  checkout_expired: 'Checkout session expired — please start again.',
  hash_mismatch: 'Payment could not be verified — please contact support.',
  no_subscription: 'No active subscription found.',
};

export function errorMessage(code?: string, fallback = 'Something went wrong — please try again.'): string {
  return (code && MESSAGES[code]) || fallback;
}
