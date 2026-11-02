import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

// Created once, jose caches the keys and refreshes them when needed.
const jwks = env.clientUrl ? createRemoteJWKSet(new URL(`${env.clientUrl}/api/auth/jwks`)) : null;

/** Checks the Better Auth JWT sent as "Authorization: Bearer <token>". */
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Unauthorized: missing token." });
    return;
  }
  if (!jwks) {
    res.status(500).json({ message: "Server is missing CLIENT_URL." });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized: invalid or expired token." });
  }
}
