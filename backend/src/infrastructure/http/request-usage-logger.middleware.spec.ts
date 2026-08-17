import { EventEmitter } from 'node:events';

import type { Request, Response } from 'express';

import { requestUsageLogger } from './request-usage-logger.middleware';

describe('requestUsageLogger', () => {
  it('records metadata without query parameters or request content', () => {
    const log = jest.fn();
    const next = jest.fn();
    const response = Object.assign(new EventEmitter(), {
      statusCode: 201,
      setHeader: jest.fn(),
    }) as unknown as Response;
    const request = {
      method: 'POST',
      path: '/api/checkout/transactions',
      originalUrl: '/api/checkout/transactions?email=private@example.com',
      body: { cardNumber: '4242424242424242' },
    } as Request;

    requestUsageLogger({ log })(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));

    const entry = JSON.parse(log.mock.calls[0][0]) as Record<string, unknown>;
    expect(entry).toMatchObject({
      event: 'api.request',
      method: 'POST',
      path: '/api/checkout/transactions',
      statusCode: 201,
    });
    expect(entry.requestId).toEqual(expect.any(String));
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(entry)).not.toContain('private@example.com');
    expect(JSON.stringify(entry)).not.toContain('4242424242424242');
  });
});
