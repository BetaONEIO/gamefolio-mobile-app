import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt-service';
import { storage } from '../storage';
import { getDemoUser } from '../demo-user';

/**
 * Hybrid authentication middleware that supports both session-based and JWT token authentication
 * This allows both web clients (using sessions) and desktop apps (using JWT) to use the same API
 */
export const hybridAuth = async (req: Request, res: Response, next: NextFunction) => {
  // First, check if user is authenticated via Passport session
  if (req.isAuthenticated() && req.user) {
    return next();
  }

  // If no session, check for JWT token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify JWT token
    const payload = JWTService.verifyToken(token);
    
    // Special handling for demo user (ID 999) - not in database
    let user;
    if (Number(payload.userId) === 999) {
      user = getDemoUser();
    } else {
      // Fetch regular user from database
      user = await storage.getUserById(payload.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
    }

    // Attach user to request object (similar to Passport session)
    req.user = user as any;
    
    return next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({ message: 'Token has expired', code: 'TOKEN_EXPIRED' });
      }
      if (error.message.includes('Invalid')) {
        return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
      }
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * Email verification middleware for hybrid authentication
 * Works with both session and JWT authentication
 */
export const hybridEmailVerification = async (req: Request, res: Response, next: NextFunction) => {
  // First ensure user is authenticated (via session or JWT)
  await hybridAuth(req, res, () => {
    const user = req.user as any;
    
    // Demo user bypasses email verification
    if (user.id === 999) {
      return next();
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    return next();
  });
};

/**
 * Onboarding completion middleware for hybrid authentication
 * Works with both session and JWT authentication
 */
export const hybridOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  // First ensure user is authenticated (via session or JWT)
  await hybridAuth(req, res, () => {
    const user = req.user as any;
    
    // Admin users bypass onboarding requirements
    if (user.role === 'admin') {
      return next();
    }
    
    // Demo user bypasses onboarding requirements
    if (user.id === 999) {
      return next();
    }

    const needsOnboarding = !user.userType;

    if (needsOnboarding) {
      return res.status(403).json({
        message: 'Onboarding required',
        code: 'ONBOARDING_REQUIRED',
        userId: user.id,
        username: user.username,
      });
    }

    return next();
  });
};

/**
 * Full access middleware for hybrid authentication
 * Combines authentication, email verification, and onboarding checks
 * Works with both session and JWT authentication
 */
export const hybridFullAccess = async (req: Request, res: Response, next: NextFunction) => {
  await hybridAuth(req, res, () => {
    hybridEmailVerification(req, res, () => {
      hybridOnboarding(req, res, next);
    });
  });
};
