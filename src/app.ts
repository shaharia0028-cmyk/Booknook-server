import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import booksRouter from "./routes/books.js";
import borrowsRouter from "./routes/borrows.js";

const app = express();

app.use(cors({ origin: env.clientUrl || true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "BookNook server is running." });
});

app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
