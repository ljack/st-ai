import test from 'node:test';
import assert from 'node:assert';
import {
  deriveLoginSecret,
  pbkdf2KeyForSalt,
  hotp6,
  signParams
} from './auth/crypto.js';

test('Cryptographic Key Derivation Tests', async (t) => {
  await t.test('deriveLoginSecret matches Go golden hex', () => {
    const gotSecret = deriveLoginSecret();
    const gotHex = Buffer.from(gotSecret, 'utf-8').toString('hex');
    const expectedHex = "77764342455243417a3730794252723964531c7e2b5803454d394c5564065765451d774e5c4b666f2059584252402d002e01efbfbdefbfbdefbfbd5f12633667570c5e7a2e505515245a2d4d204a230c577f6e253437050c57791376";
    assert.strictEqual(gotHex, expectedHex);
  });

  await t.test('pbkdf2KeyForSalt matches Go golden hex for Alice', () => {
    const gotKey = pbkdf2KeyForSalt('alice@example.com');
    const gotHex = gotKey.toString('hex');
    const expectedHex = "15d70cdb1125776ce85e91af922c2ba6db8917d994bf2a283fc5b249acf72e8e";
    assert.strictEqual(gotHex, expectedHex);
  });

  await t.test('hotp6 matches Go code at counter 1000000', () => {
    const key = pbkdf2KeyForSalt('alice@example.com');
    const gotCode = hotp6(key, 1000000);
    assert.strictEqual(gotCode, "215251");
  });

  await t.test('signParams matches Go signature for foo@bar.com', () => {
    const params = [
      { key: 'l', value: 'foo@bar.com' },
      { key: 'p', value: 'Pass123' }
    ];
    const gotSig = signParams('login', params);
    assert.strictEqual(gotSig, "Sf8mC1rPA6rrZh0uHpdwh-TkSlQLO0hkKs4S_6vdBqo");
  });
});
