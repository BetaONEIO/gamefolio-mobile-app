import crypto from 'crypto';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SKALE_NEBULA_TESTNET } from '../shared/contracts';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptPrivateKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function getUserWalletClient(encryptedPrivateKey: string) {
  const privateKey = decryptPrivateKey(encryptedPrivateKey);
  const formattedKey = privateKey.startsWith('0x')
    ? (privateKey as `0x${string}`)
    : (`0x${privateKey}` as `0x${string}`);

  const account = privateKeyToAccount(formattedKey);

  return createWalletClient({
    account,
    chain: SKALE_NEBULA_TESTNET,
    transport: http(SKALE_NEBULA_TESTNET.rpcUrls.default.http[0]),
  });
}
