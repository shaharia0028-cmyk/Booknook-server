import { Router } from "express";
import { ObjectId, type Filter } from "mongodb";
import { booksCollection, borrowsCollection } from "../config/db.js";
import { verifyToken } from "../middleware/verify-token.js";
import type { Book } from "../types/book.js";
import type { Borrow } from "../types/borrow.js";
import { escapeRegex, isHttpUrl, text } from "../utils/helpers.js";

const router = Router();

const BORROW_DAYS = 7;
const serialize = ({ _id, ...rest }: Book) => ({ _id: String(_id), ...rest });

type BookFields = Pick<Book, "title" | "author" | "category" | "image" | "description" | "copies">;

/** Validates book fields. With partial = true only the fields that were sent are checked. */
function parseBookFields(body: Record<string, unknown> | undefined, partial: boolean) {
  const input = body ?? {};
  const fields: Partial<BookFields> = {};
  const has = (key: string) => !partial || input[key] !== undefined;

  for (const key of ["title", "author", "category", "description"] as const) {
    if (!has(key)) continue;
    const value = text(input[key]);
    if (!value) return { error: `${key[0].toUpperCase()}${key.slice(1)} is required.` };
    fields[key] = value;
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

// Public: newest books first. Used by the Home page (New Arrivals).
router.get("/latest", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 24);
  const books = await (await booksCollection()).find().sort({ createdAt: -1 }).limit(limit).toArray();
  res.json(books.map(serialize));
});

// Private: the books the signed-in user added.
router.get("/mine", verifyToken, async (req, res) => {
  const books = await (await booksCollection())
    .find({ ownerEmail: String(req.user?.email ?? "") })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(books.map(serialize));
});

// Public: all books, with optional ?search= and ?category=
router.get("/", async (req, res) => {
  const search = text(req.query.search);
  const category = text(req.query.category);

  const filter: Filter<Book> = {};
  if (category) filter.category = category;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: pattern }, { author: pattern }];
  }

  const books = await (await booksCollection()).find(filter).sort({ createdAt: -1 }).toArray();
  res.json(books.map(serialize));
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

// Private: borrow a book for 7 days
router.post("/:id/borrow", verifyToken, async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) {
    res.status(400).json({ message: "Invalid book id." });
    return;
  }

  const userEmail = String(req.user?.email ?? "");
  const userName = String(req.user?.name ?? "");
  const books = await booksCollection();
  const borrows = await borrowsCollection();
  const bookId = String(_id);

  if (await borrows.findOne({ bookId, userEmail })) {
    res.status(409).json({ message: "You already borrowed this book" });
    return;
  }

  // Take one copy only if one is left, so two people cannot borrow the last copy.
  const book = await books.findOneAndUpdate({ _id, copies: { $gt: 0 } }, { $inc: { copies: -1 } });
  if (!book) {
    const exists = await books.findOne({ _id }, { projection: { _id: 1 } });
    res.status(exists ? 409 : 404).json({ message: exists ? "No copies left to borrow." : "Book not found." });
    return;
  }

  const borrowDate = new Date();
  const returnDate = new Date(borrowDate.getTime() + BORROW_DAYS * 24 * 60 * 60 * 1000);
  const borrow: Borrow = {
    bookId,
    bookTitle: book.title,
    bookImage: book.image,
    userEmail,
    userName,
    borrowDate,
    returnDate,
  };

  try {
    const result = await borrows.insertOne(borrow);
    res.status(201).json({ ...borrow, _id: String(result.insertedId) });
  } catch (error) {
    await books.updateOne({ _id }, { $inc: { copies: 1 } }); // give the copy back
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: "You already borrowed this book" });
      return;
    }
    throw error;
  }
});

export default router;
