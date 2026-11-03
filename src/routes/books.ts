import { Router } from "express";
import { ObjectId, type Filter } from "mongodb";
import { booksCollection, borrowsCollection } from "../config/db.js";
import { verifyToken } from "../middleware/verify-token.js";
import type { Book } from "../types/book.js";
import { BOOK_CATEGORIES } from "../utils/constants.js";
import { escapeRegex, isHttpUrl, text } from "../utils/helpers.js";

const router = Router();

const serialize = ({ _id, ...rest }: Book) => ({ _id: String(_id), ...rest });

type BookFields = Pick<Book, "title" | "author" | "category" | "image" | "description" | "copies">;

/** Validates book fields. With partial = true only the fields that were sent are checked. */
function parseBookFields(body: Record<string, unknown> | undefined, partial: boolean) {
  const input = body ?? {};
  const fields: Partial<BookFields> = {};
  const has = (key: string) => !partial || input[key] !== undefined;

  for (const key of ["title", "author", "description"] as const) {
    if (!has(key)) continue;
    const value = text(input[key]);
    if (!value) return { error: `${key[0].toUpperCase()}${key.slice(1)} is required.` };
    fields[key] = value;
  }

  if (has("category")) {
    const category = text(input.category);
    if (!(BOOK_CATEGORIES as readonly string[]).includes(category)) {
      return { error: `Category must be one of: ${BOOK_CATEGORIES.join(", ")}.` };
    }
    fields.category = category;
  }

  if (has("image")) {
    const image = text(input.image);
    if (!isHttpUrl(image)) return { error: "A valid image URL is required." };
    fields.image = image;
  }

  if (has("copies")) {
    const copies = Number(input.copies);
    if (!Number.isInteger(copies) || copies < (partial ? 0 : 1) || copies > 999) {
      return { error: "Copies must be a whole number." };
    }
    fields.copies = copies;
  }

  return { fields };
}

function parseId(value: unknown) {
  const id = String(value);
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// Public: books, newest first (sorted and limited in MongoDB).
// Optional: ?search= ?category= ?email= (books added by one user) ?page= ?limit= (default 20)
router.get("/", async (req, res) => {
  const search = text(req.query.search);
  const category = text(req.query.category);
  const email = text(req.query.email);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const requestedPage = Math.floor(Number(req.query.page));
  const page = requestedPage >= 1 ? requestedPage : 1;

  const filter: Filter<Book> = {};
  if (category) filter.category = category;
  if (email) filter.ownerEmail = email;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: pattern }, { author: pattern }];
  }

  const books = await booksCollection();
  const total = await books.countDocuments(filter);
  const items = await books
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  res.json({ books: items.map(serialize), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// Private: one book
router.get("/:id", verifyToken, async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) {
    res.status(400).json({ message: "Invalid book id." });
    return;
  }

  const book = await (await booksCollection()).findOne({ _id });
  if (!book) {
    res.status(404).json({ message: "Book not found." });
    return;
  }
  res.json(serialize(book));
});

// Private: add a book. The owner comes from the verified token, not from the request body.
router.post("/", verifyToken, async (req, res) => {
  const { fields, error } = parseBookFields(req.body, false);
  if (!fields) {
    res.status(400).json({ message: error });
    return;
  }

  const book: Book = {
    ...(fields as BookFields),
    ownerEmail: String(req.user?.email ?? ""),
    ownerName: String(req.user?.name ?? ""),
    createdAt: new Date(),
  };

  const result = await (await booksCollection()).insertOne(book);
  res.status(201).json({ ...book, _id: String(result.insertedId) });
});

// Private: edit your own book
router.patch("/:id", verifyToken, async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) {
    res.status(400).json({ message: "Invalid book id." });
    return;
  }

  const { fields, error } = parseBookFields(req.body, true);
  if (!fields) {
    res.status(400).json({ message: error });
    return;
  }

  const books = await booksCollection();
  const book = await books.findOne({ _id });
  if (!book) {
    res.status(404).json({ message: "Book not found." });
    return;
  }
  if (book.ownerEmail !== req.user?.email) {
    res.status(403).json({ message: "You can only edit your own books." });
    return;
  }

  await books.updateOne({ _id }, { $set: fields });
  res.json({ message: "Book updated." });
});

// Private: delete your own book (not while someone has it borrowed)
router.delete("/:id", verifyToken, async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) {
    res.status(400).json({ message: "Invalid book id." });
    return;
  }

  const books = await booksCollection();
  const book = await books.findOne({ _id });
  if (!book) {
    res.status(404).json({ message: "Book not found." });
    return;
  }
  if (book.ownerEmail !== req.user?.email) {
    res.status(403).json({ message: "You can only delete your own books." });
    return;
  }
  if (await (await borrowsCollection()).findOne({ bookId: String(_id) })) {
    res.status(409).json({ message: "This book is currently borrowed and cannot be deleted yet." });
    return;
  }

  await books.deleteOne({ _id });
  res.json({ message: "Book deleted." });
});

export default router;
