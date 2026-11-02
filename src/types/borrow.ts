import type { ObjectId } from "mongodb";

export interface Borrow {
  _id?: ObjectId;
  bookId: string;
  bookTitle: string;
  bookImage: string;
  userEmail: string;
  userName: string;
  borrowDate: Date;
  returnDate: Date;
}
