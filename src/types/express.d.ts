import type { JWTPayload } from "jose";

declare global {
  namespace Express {
    interface Request {
      /** Set by verifyToken: the Better Auth user taken from the JWT. */
      user?: JWTPayload & { email?: string; name?: string };
    }
  }
}

export {};
