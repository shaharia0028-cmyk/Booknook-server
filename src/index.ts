import app from "./app.js";
import { env } from "./config/env.js";

// On Vercel the platform handles the port, so only listen when running locally.
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Server is running on http://localhost:${env.port}`);
  });
}

export default app;
