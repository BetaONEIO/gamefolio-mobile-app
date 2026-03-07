import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware - checks if user is authenticated via session
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Check if the user is authenticated via session
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ message: "Not authenticated" });
};

/**
 * Email verification middleware - checks if authenticated user's email is verified
 */
export const emailVerificationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = req.user as any;
  
  // Demo user bypasses email verification (use secure ID check)
  if (user.id === 999) {
    return next();
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      message: "Email verification required",
      code: "EMAIL_NOT_VERIFIED",
      email: user.email
    });
  }

  return next();
};

/**
 * Onboarding completion middleware - checks if user has completed onboarding
 */
export const onboardingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = req.user as any;
  
  // Admin users bypass onboarding requirements
  if (user.role === "admin") {
    return next();
  }
  
  // Demo user bypasses onboarding requirements (use secure ID check)
  if (user.id === 999) {
    return next();
  }

  const needsOnboarding = !user.userType;

  if (needsOnboarding) {
    return res.status(403).json({
      message: "Onboarding required",
      code: "ONBOARDING_REQUIRED",
      userId: user.id,
      username: user.username
    });
  }

  return next();
};

/**
 * Combined middleware for full access (authenticated + verified + onboarded)
 * Use this for routes that require users to have completed the full registration process
 */
export const fullAccessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, () => {
    emailVerificationMiddleware(req, res, () => {
      onboardingMiddleware(req, res, next);
    });
  });
};