import jwt from 'jsonwebtoken';

// Primary secret from env; fallback is the app default (also stored in constants/Env.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'Jkdjsl$22Awj2@32kjlskjfads232s';
const APP_DEFAULT_SECRET = 'Jkdjsl$22Awj2@32kjlskjfads232s';

// All secrets to try during verification (supports cross-environment tokens)
const VERIFY_SECRETS = Array.from(new Set([JWT_SECRET, APP_DEFAULT_SECRET]));

const ACCESS_TOKEN_EXPIRY = '7d'; // 7 days
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface TokenPayload {
  userId: number;
  type: 'access' | 'refresh';
}

function verifyWithAnySecret(token: string): TokenPayload {
  for (const secret of VERIFY_SECRETS) {
    try {
      return jwt.verify(token, secret) as TokenPayload;
    } catch {
      // try next secret
    }
  }
  throw new jwt.JsonWebTokenError('Invalid token');
}

/**
 * Generate an access token for a user
 */
export function generateAccessToken(userId: number): string {
  const payload: TokenPayload = {
    userId,
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY
  });
}

/**
 * Generate a refresh token for a user
 */
export function generateRefreshToken(userId: number): string {
  const payload: TokenPayload = {
    userId,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY
  });
}

/**
 * Verify an access token and return the user ID
 */
export function verifyAccessToken(token: string): number | null {
  try {
    const payload = verifyWithAnySecret(token);

    if (payload.type !== 'access') {
      return null;
    }

    return payload.userId;
  } catch (error) {
    console.error('Access token verification failed:', error);
    return null;
  }
}

/**
 * Verify a refresh token and return the user ID
 */
export function verifyRefreshToken(token: string): number | null {
  try {
    const payload = verifyWithAnySecret(token);

    if (payload.type !== 'refresh') {
      return null;
    }

    return payload.userId;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * JWTService class for token-based authentication
 * Used by desktop/mobile apps for session-less authentication
 */
export class JWTService {
  /**
   * Generate access and refresh token pair for a user
   */
  static generateTokenPair(user: { id: number }): { accessToken: string; refreshToken: string } {
    return {
      accessToken: generateAccessToken(user.id),
      refreshToken: generateRefreshToken(user.id),
    };
  }

  /**
   * Verify a token and return the payload
   * Throws an error if token is invalid or expired
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return verifyWithAnySecret(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }
}
