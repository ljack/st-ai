import crypto from 'crypto';
import {
  loginKeyPart1,
  loginKeyPart2,
  loginKeyPart3,
  totpKeyPart1,
  totpKeyPart2,
  totpObfuscationKey,
  PACKAGE_NAME
} from './keys.js';

export function keyObfuscator(sBytes: Buffer, pkg: string): Buffer {
  const pkgBytes = Buffer.from(pkg, 'utf-8');
  const out = Buffer.alloc(sBytes.length);
  for (let i = 0; i < sBytes.length; i++) {
    out[i] = sBytes[i] ^ pkgBytes[i % pkgBytes.length];
  }
  return out;
}

export function utf8Replace(buffer: Buffer): Buffer {
  const decoded = buffer.toString('utf-8');
  return Buffer.from(decoded, 'utf-8');
}

export function deriveObfuscatedSecret(parts: string[], pkg: string): Buffer {
  const joined = parts.join('');
  const raw = Buffer.from(joined, 'base64');
  const mid = utf8Replace(raw);
  const xored = keyObfuscator(mid, pkg);
  return utf8Replace(xored);
}

export function deriveLoginSecret(): string {
  return deriveObfuscatedSecret([loginKeyPart1, loginKeyPart2, loginKeyPart3], PACKAGE_NAME).toString('utf-8');
}

export function deriveTOTPMasterSecret(): string {
  return deriveObfuscatedSecret([totpKeyPart1, totpKeyPart2], totpObfuscationKey).toString('utf-8');
}

export function signParams(path: string, params: { key: string; value: string }[]): string {
  const loginSecret = deriveLoginSecret();
  let sb = `POST&${path}`;
  for (const p of params) {
    sb += `&${p.key}=${p.value}`;
  }
  sb += `&secret=${loginSecret}`;
  return crypto.createHash('sha256').update(sb, 'utf-8').digest('base64url');
}

export function pbkdf2KeyForSalt(salt: string): Buffer {
  const master = deriveTOTPMasterSecret();
  const pwd = Buffer.from(master, 'utf-8');
  const saltBuf = Buffer.from(salt, 'utf-8');
  return crypto.pbkdf2Sync(pwd, saltBuf, 100, 32, 'sha1');
}

export function hotp6(key: Buffer, counter: number | bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buf);
  const d = hmac.digest();
  
  const off = d[d.length - 1] & 0x0f;
  const code = ((d[off] & 0x7f) << 24) |
               (d[off + 1] << 16) |
               (d[off + 2] << 8) |
               d[off + 3];
               
  const result = code % 1000000;
  return String(result).padStart(6, '0');
}

export function generateTOTP(salt: string, offsetMS: number = 0): string {
  const key = pbkdf2KeyForSalt(salt);
  const now = Date.now() + offsetMS;
  const counter = Math.floor(now / 30000);
  return hotp6(key, counter);
}

export function generateRandomSalt(): string {
  return crypto.randomBytes(16).toString('base64url');
}
