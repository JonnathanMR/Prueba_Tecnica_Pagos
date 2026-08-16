import { createHash, generateKeyPairSync } from 'node:crypto';

import {
  PaymentGatewayError,
  SandboxPaymentGatewayAdapter,
} from './sandbox-payment-gateway.adapter';

describe('SandboxPaymentGatewayAdapter', () => {
  it('gets both acceptance tokens from the merchant endpoint', async () => {
    const request = fetchMock(
      jsonResponse({
        data: {
          presigned_acceptance: { acceptance_token: 'acceptance-token', permalink: 'https://example.test/terms' },
          presigned_personal_data_auth: { acceptance_token: 'personal-token', permalink: 'https://example.test/privacy' },
        },
      }),
    );
    const adapter = adapterFor(request);

    await expect(adapter.getAcceptanceData()).resolves.toEqual({
      acceptanceToken: 'acceptance-token', acceptancePermalink: 'https://example.test/terms',
      personalDataAuthToken: 'personal-token', personalDataAuthPermalink: 'https://example.test/privacy',
    });
    expect(request).toHaveBeenCalledWith('https://sandbox.example/v1/merchants/public-key', { method: 'GET' });
  });

  it('encrypts card data as JWE before requesting a card token', async () => {
    const encryptionPublicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const request = fetchMock(
      jsonResponse({ data: { publicKey: encryptionPublicKey } }),
      jsonResponse({ data: { id: 'card-token', brand: 'VISA', last_four: '4242' } }),
    );
    const adapter = adapterFor(request);

    await expect(
      adapter.tokenizeCard({ number: '4242424242424242', cvc: '123', expMonth: '08', expYear: '30', cardHolder: 'Ana Pérez' }),
    ).resolves.toEqual({ token: 'card-token', brand: 'VISA', lastFour: '4242' });

    const [, requestInit] = request.mock.calls[1] as [string, RequestInit];
    const body = String(requestInit.body);
    expect(body).not.toContain('4242424242424242');
    expect(body).not.toContain('"cvc":"123"');
    expect(JSON.parse(body).payload.split('.')).toHaveLength(5);
    expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer public-key' });
  });

  it('normalizes a Base64 tokenization key before creating the JWE', async () => {
    const pemKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const base64Key = pemKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const request = fetchMock(
      jsonResponse({ data: { publicKey: base64Key } }),
      jsonResponse({ data: { id: 'card-token', brand: 'VISA', last_four: '4242' } }),
    );
    const adapter = adapterFor(request);

    await expect(
      adapter.tokenizeCard({ number: '4242424242424242', cvc: '123', expMonth: '08', expYear: '30', cardHolder: 'Ana Pérez' }),
    ).resolves.toEqual({ token: 'card-token', brand: 'VISA', lastFour: '4242' });
  });

  it('sends the private key and integrity signature when creating a payment', async () => {
    const request = fetchMock(jsonResponse({ data: { id: 'provider-id', status: 'PENDING' } }));
    const adapter = adapterFor(request);

    await expect(
      adapter.createCardPayment({
        reference: 'reference-1', amountInCents: 106_500, currency: 'COP', customerEmail: 'ana@example.com',
        cardToken: 'card-token', idempotencyKey: 'idem-key', installments: 1,
        acceptanceToken: 'acceptance-token', acceptPersonalAuth: 'personal-token', customerIp: '127.0.0.1',
      }),
    ).resolves.toMatchObject({ providerTransactionId: 'provider-id', status: 'PENDING' });

    const [, requestInit] = request.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as Record<string, unknown>;
    expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer private-key' });
    expect(body.signature).toBe(
      createHash('sha256').update('reference-1106500COPintegrity-secret', 'utf8').digest('hex'),
    );
    expect(body).toMatchObject({ acceptance_token: 'acceptance-token', accept_personal_auth: 'personal-token' });
  });

  it('maps a rejected provider response to a safe gateway error', async () => {
    const request = fetchMock(jsonResponse({ error: 'provider details are hidden' }, false));
    const adapter = adapterFor(request);

    await expect(adapter.findPayment('provider-id')).rejects.toEqual(
      new PaymentGatewayError('The payment gateway rejected the request (400).'),
    );
  });

  it('fails fast when a required configuration value is missing', () => {
    expect(() =>
      new SandboxPaymentGatewayAdapter({
        baseUrl: 'https://sandbox.example/v1', publicKey: '', privateKey: 'private-key', integritySecret: 'integrity-secret',
      }),
    ).toThrow('publicKey must be configured.');
  });
});

function adapterFor(request: jest.MockedFunction<typeof fetch>): SandboxPaymentGatewayAdapter {
  return new SandboxPaymentGatewayAdapter(
    {
      baseUrl: 'https://sandbox.example/v1',
      publicKey: 'public-key',
      privateKey: 'private-key',
      integritySecret: 'integrity-secret',
    },
    request,
  );
}

function fetchMock(...responses: Response[]): jest.MockedFunction<typeof fetch> {
  return jest.fn().mockImplementation(async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected fetch call.');
    return response;
  }) as jest.MockedFunction<typeof fetch>;
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as Response;
}
