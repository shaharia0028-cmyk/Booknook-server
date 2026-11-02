import type { ObjectId } from "mongodb";

export interface Book {
  _id?: ObjectId;
  title: string;
  author: string;
  category: string;
  image: string;
  description: string;
  /** Copies available to borrow right now. */
  copies: number;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
}
