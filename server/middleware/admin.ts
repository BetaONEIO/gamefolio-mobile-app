import { Request, Response, NextFunction } from "express";

/**
 * Middleware to ensure only admin users can access admin routes
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if user has admin role
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  // User is authenticated and has admin role
  next();
};