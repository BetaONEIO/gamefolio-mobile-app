import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via Passport session
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  next();
};

// Alias for compatibility with legacy imports
export const authMiddleware = requireAuth;