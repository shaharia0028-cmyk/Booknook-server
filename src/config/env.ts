import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 8000,
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDb: process.env.MONGODB_DB || undefined,
  clientUrl: (process.env.CLIENT_URL ?? "").replace(/\/$/, ""),
};
