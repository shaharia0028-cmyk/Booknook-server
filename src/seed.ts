import { booksCollection } from "./config/db.js";
import type { Book } from "./types/book.js";

const [ownerEmail, ...nameParts] = process.argv.slice(2);
const ownerName = nameParts.join(" ").trim();

if (!ownerEmail || !ownerName) {
  console.log('Usage: npm run seed -- you@example.com "Your Name"');
  process.exit(1);
}

const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

const books = [
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    category: "Fiction",
    copies: 3,
    image: cover("9780547928227"),
    description: "Bilbo Baggins leaves his quiet hole for a quest with thirteen dwarves and a dragon at the end.",
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    category: "Fiction",
    copies: 2,
    image: cover("9780141439518"),
    description: "Elizabeth Bennet and Mr. Darcy navigate pride, class and first impressions in Regency England.",
  },
  {
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    category: "Science",
    copies: 4,
    image: cover("9780553380163"),
    description: "A clear and friendly tour of black holes, the Big Bang and the nature of time.",
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    category: "History",
    copies: 3,
    image: cover("9780062316097"),
    description: "A sweeping history of how humans came to dominate the planet, from the Stone Age to today.",
  },
  {
    title: "Clean Code",
    author: "Robert C. Martin",
    category: "Technology",
    copies: 2,
    image: cover("9780132350884"),
    description: "A practical handbook on writing readable, maintainable code that other developers will thank you for.",
  },
  {
    title: "Matilda",
    author: "Roald Dahl",
    category: "Children",
    copies: 5,
    image: cover("9780142410370"),
    description: "A gifted girl with a love of books uses her quick mind and a little magic to outsmart a cruel headmistress.",
  },
];

async function main() {
  console.log("Connecting to MongoDB...");
  const collection = await booksCollection();
  console.log("Connected. Adding books...");
  let added = 0;

  for (const [index, book] of books.entries()) {
    const exists = await collection.findOne({ title: book.title, ownerEmail });
    if (exists) {
      console.log(`Skipped (already exists): ${book.title}`);
      continue;
    }

    // Slightly different times so the newest-first order is stable.
    const doc: Book = { ...book, ownerEmail, ownerName, createdAt: new Date(Date.now() + index * 1000) };
    await collection.insertOne(doc);
    console.log(`Added: ${book.title}`);
    added++;
  }

  console.log(`Done. ${added} book(s) added.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
