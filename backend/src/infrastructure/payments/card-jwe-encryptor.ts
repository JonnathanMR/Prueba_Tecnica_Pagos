import {
  constants,
  createCipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

import type { CardTokenizationInput } from '../../domain/transaction/payment-gateway.port';

/**
 * Cifra datos efímeros de tarjeta como JWE compacto. El resultado es seguro
 * para enviarse al proveedor, pero el PAN y CVC nunca se almacenan ni registran.
 */
export function encryptCardAsJwe(input: CardTokenizationInput, publicKeyPem: string): string {
  const protectedHeader = toBase64Url(
    JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' }),
  );
  const contentEncryptionKey = randomBytes(32);
  const initializationVector = randomBytes(12);
  const encryptedKey = publicEncrypt(
    {
      key: createPublicKey(publicKeyPem),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    contentEncryptionKey,
  );
  const cipher = createCipheriv('aes-256-gcm', contentEncryptionKey, initializationVector);
  cipher.setAAD(Buffer.from(protectedHeader, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(
      JSON.stringify({
        number: input.number,
        cvc: input.cvc,
        exp_month: input.expMonth,
        exp_year: input.expYear,
        card_holder: input.cardHolder,
      }),
      'utf8',
    ),
    cipher.final(),
  ]);

  return [
    protectedHeader,
    toBase64Url(encryptedKey),
    toBase64Url(initializationVector),
    toBase64Url(ciphertext),
    toBase64Url(cipher.getAuthTag()),
  ].join('.');
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}
