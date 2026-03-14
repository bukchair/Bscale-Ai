import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { integrationsEnv } from '@/src/lib/env/integrations-env';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LENGTH = 12;

type KeyRecord = {
  kid: string;
  key: Buffer;
};

const loadKeyring = (): KeyRecord[] => {
  const records: KeyRecord[] = [];
  const primary = Buffer.from(integrationsEnv.ENCRYPTION_KEY, 'base64');
  records.push({ kid: 'primary', key: primary });

  const previous = process.env.ENCRYPTION_KEY_PREVIOUS
    ? process.env.ENCRYPTION_KEY_PREVIOUS.split(',').map((v) => v.trim())
    : [];

  previous.forEach((base64Key, index) => {
    if (!base64Key) return;
    records.push({ kid: `prev_${index + 1}`, key: Buffer.from(base64Key, 'base64') });
  });

  return records;
};

const keyring = loadKeyring();

export const encryptSecret = (plaintext: string): string => {
  const activeKey = keyring[0];
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, activeKey.key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    activeKey.kid,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join(':');
};

export const decryptSecret = (encryptedPayload: string): string => {
  const [version, kid, ivB64, cipherB64, tagB64] = encryptedPayload.split(':');
  if (version !== VERSION || !kid || !ivB64 || !cipherB64 || !tagB64) {
    throw new Error('Invalid encrypted payload format.');
  }

  const keyRecord = keyring.find((record) => record.kid === kid);
  if (!keyRecord) {
    throw new Error(`No encryption key found for kid "${kid}".`);
  }

  const decipher = createDecipheriv(ALGORITHM, keyRecord.key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};
