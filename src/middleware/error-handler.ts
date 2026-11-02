import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Route not found." });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Something went wrong on the server." });
};
