import { SignJWT, jwtVerify } from 'jose';
import { Request, Response } from 'express';
import * as db from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
);

const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate JWT token for user
 */
export async function generateToken(userId: number): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number };
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate request and return user
 */
export async function authenticateRequest(req: Request): Promise<{
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
} | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await db.getUserById(payload.userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * Set session cookie
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}
