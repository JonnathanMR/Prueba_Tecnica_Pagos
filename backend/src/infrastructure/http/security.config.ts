import type { HelmetOptions } from 'helmet';

const localFrontendOrigin = 'http://localhost:5173';

export function allowedCorsOrigins(value: string | undefined, environment: string | undefined): string[] {
  const configuredOrigins = value ?? (environment === 'production' ? '' : localFrontendOrigin);
  const origins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);

  if (environment === 'production' && origins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CORS_ORIGINS must use HTTPS in production.');
  }

  return [...new Set(origins)];
}

export function shouldEnforceHttps(value: string | undefined, environment: string | undefined): boolean {
  if (value === undefined) return environment === 'production';
  if (value !== 'true' && value !== 'false') throw new Error('ENFORCE_HTTPS must be true or false.');
  return value === 'true';
}

export function securityHeaders(enforceHttps: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: {
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        defaultSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: enforceHttps ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: enforceHttps ? { maxAge: 63_072_000 } : false,
  };
}

export function requestUsesHttps(isSecure: boolean, forwardedProtocol: string | string[] | undefined): boolean {
  const forwardedProtocols = Array.isArray(forwardedProtocol) ? forwardedProtocol : [forwardedProtocol];
  return isSecure || forwardedProtocols.some((protocol) => protocol?.split(',').some((value) => value.trim() === 'https'));
}
