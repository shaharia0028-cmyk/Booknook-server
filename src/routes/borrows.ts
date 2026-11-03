import { Router } from "express";
import { ObjectId } from "mongodb";
import { booksCollection, borrowsCollection } from "../config/db.js";
import { verifyToken } from "../middleware/verify-token.js";
import type { Borrow } from "../types/borrow.js";
import { text } from "../utils/helpers.js";

const router = Router();

const BORROW_DAYS = 7;

// Private: borrow a book for 7 days. Body: { bookId }
router.post("/", verifyToken, async (req, res) => {
  const bookId = text(req.body?.bookId);
  if (!ObjectId.isValid(bookId)) {
    res.status(400).json({ message: "Invalid book id." });
    return;
  }

  const _id = new ObjectId(bookId);
  const userEmail = String(req.user?.email ?? "");
  const userName = String(req.user?.name ?? "");
  const books = await booksCollection();
  const borrows = await borrowsCollection();

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

// Private: the books the signed-in user has borrowed.
router.get("/", verifyToken, async (req, res) => {
  const borrows = await (await borrowsCollection())
    .find({ userEmail: String(req.user?.email ?? "") })
    .sort({ borrowDate: -1 })
    .toArray();
  res.json(borrows.map(({ _id, ...rest }) => ({ _id: String(_id), ...rest })));
});

// Private: return a borrowed book (gives the copy back to the shelf).
router.delete("/:id", verifyToken, async (req, res) => {
  const id = String(req.params.id);
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid borrow id." });
    return;
  }

  const borrow = await (await borrowsCollection()).findOneAndDelete({
    _id: new ObjectId(id),
    userEmail: String(req.user?.email ?? ""),
  });
  if (!borrow) {
    res.status(404).json({ message: "Borrow record not found." });
    return;
  }

  if (ObjectId.isValid(borrow.bookId)) {
    await (await booksCollection()).updateOne({ _id: new ObjectId(borrow.bookId) }, { $inc: { copies: 1 } });
  }
  res.json({ message: "Book returned." });
});

export default router;
