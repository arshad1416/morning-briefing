import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../src/password.js';

describe('password', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const h = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('produces distinct salts each call', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });
  it('DUMMY_HASH verifies against nothing but does not throw', async () => {
    expect(await verifyPassword('anything', DUMMY_HASH)).toBe(false);
  });
});
