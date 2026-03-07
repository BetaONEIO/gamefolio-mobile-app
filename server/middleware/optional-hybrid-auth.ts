import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt-service';
import { storage } from '../storage';
import { getDemoUser } from '../demo-user';

/**
 * Optional hybrid authentication middleware
 * Attempts to authenticate via session or JWT, but doesn't require authentication
 * Useful for endpoints that support guest access but should include user data if available
 */
export const optionalHybridAuth = async (req: Request, res: Response, next: NextFunction) => {
  // First, check if user is authenticated via Passport session
  if (req.isAuthenticated() && req.user) {
    console.log('✅ Optional hybrid auth: User authenticated via session');
    return next();
  }

  // If no session, check for JWT token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No authentication provided - continue as guest
    console.log('ℹ️ Optional hybrid auth: No authentication provided, continuing as guest');
    return next();
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  console.log('🔍 Optional hybrid auth: JWT token found, verifying...');

  try {
    // Verify JWT token
    const payload = JWTService.verifyToken(token);
    console.log('✅ Optional hybrid auth: Token verified for userId:', payload.userId);
    
    // Special handling for demo user (ID 999) - not in database
    let user;
    if (Number(payload.userId) === 999) {
      user = getDemoUser();
      console.log('✅ Optional hybrid auth: Using demo user');
    } else {
      // Fetch regular user from database
      user = await storage.getUserById(payload.userId);
      
      if (!user) {
        // Invalid user ID in token - continue as guest
        console.log('⚠️ Optional hybrid auth: User not found for userId:', payload.userId);
        return next();
      }
    }

    // Attach user to request object (similar to Passport session)
    req.user = user as any;
    console.log('✅ Optional hybrid auth: User attached to request:', user.username);
    
    return next();
  } catch (error) {
    // Token verification failed - continue as guest
    // Don't return error for optional auth
    console.log('⚠️ Optional hybrid auth: Token verification failed:', error);
    return next();
  }
};
