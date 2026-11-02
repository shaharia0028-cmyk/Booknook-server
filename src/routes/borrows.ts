import { Router } from "express";
import { ObjectId } from "mongodb";
import { booksCollection, borrowsCollection } from "../config/db.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

// Private: the books the signed-in user has borrowed.
router.get("/mine", verifyToken, async (req, res) => {
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

  const borrows = await borrowsCollection();
  const borrow = await borrows.findOneAndDelete({
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
