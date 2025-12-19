import { CookieOptions } from 'express';
import { config } from '@config/index';

export const cookieConfig = {
  access: {
    httpOnly: true,
    secure: config.app.isProduction, // HTTPS only in production
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  } as CookieOptions,

  refresh: {
    httpOnly: true,
    secure: config.app.isProduction,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh',
  } as CookieOptions,

  session: {
    httpOnly: true,
    secure: config.app.isProduction,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  } as CookieOptions,

  mfa_token: {
    httpOnly: true,
    secure: config.app.isProduction,
    sameSite: 'strict' as const,
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  } as CookieOptions,
};

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  SESSION_ID: 'session_id',
  MFA_TOKEN: 'mfa_token',
} as const;
