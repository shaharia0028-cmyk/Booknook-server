import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env.js";
import type { Book } from "../types/book.js";
import type { Borrow } from "../types/borrow.js";

const client = new MongoClient(env.mongoUri || "mongodb://127.0.0.1:27017", {
  serverSelectionTimeoutMS: 5000,
});

let db: Db | null = null;

/** Connects once and reuses the connection (works for serverless too). */
async function getDb(): Promise<Db> {
  if (!db) {
    if (!env.mongoUri) throw new Error("MONGODB_URI is not set.");
    await client.connect();
    const database = client.db(env.mongoDb);
    // One active borrow per person per book.
    await database.collection("borrows").createIndex({ bookId: 1, userEmail: 1 }, { unique: true });
    db = database;
  }
  return db;
}

export async function booksCollection(): Promise<Collection<Book>> {
  return (await getDb()).collection<Book>("books");
}

export async function borrowsCollection(): Promise<Collection<Borrow>> {
  return (await getDb()).collection<Borrow>("borrows");
}
