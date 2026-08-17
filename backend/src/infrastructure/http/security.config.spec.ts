import {
  allowedCorsOrigins,
  requestUsesHttps,
  securityHeaders,
  shouldEnforceHttps,
} from './security.config';

describe('HTTP security configuration', () => {
  it('uses the local frontend origin by default outside production', () => {
    expect(allowedCorsOrigins(undefined, 'development')).toEqual(['http://localhost:5173']);
    expect(allowedCorsOrigins('https://checkout.example.com, https://checkout.example.com', 'production'))
      .toEqual(['https://checkout.example.com']);
  });

  it('rejects insecure production CORS origins and invalid HTTPS flags', () => {
    expect(() => allowedCorsOrigins('http://checkout.example.com', 'production'))
      .toThrow('CORS_ORIGINS must use HTTPS in production.');
    expect(() => shouldEnforceHttps('yes', 'production')).toThrow('ENFORCE_HTTPS must be true or false.');
  });

  it('enforces HTTPS by default in production and honors a trusted forwarded protocol', () => {
    expect(shouldEnforceHttps(undefined, 'production')).toBe(true);
    expect(shouldEnforceHttps('false', 'production')).toBe(false);
    expect(requestUsesHttps(false, 'http, https')).toBe(true);
    expect(requestUsesHttps(false, 'http')).toBe(false);
  });

  it('enables HSTS only when HTTPS enforcement is active', () => {
    expect(securityHeaders(false).strictTransportSecurity).toBe(false);
    expect(securityHeaders(true).strictTransportSecurity).toEqual({ maxAge: 63_072_000 });
  });
});
