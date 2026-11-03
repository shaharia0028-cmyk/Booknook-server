import { booksCollection } from "./config/db.js";

// One-off: moves books from the old categories to the new ones.
const changes = [
  { from: ["Children"], to: "Kids" },
  { from: ["Non-Fiction", "Technology"], to: "Others" },
];

async function main() {
  const books = await booksCollection();
  for (const { from, to } of changes) {
    const result = await books.updateMany({ category: { $in: from } }, { $set: { category: to } });
    console.log(`${from.join(" + ")} -> ${to}: ${result.modifiedCount} book(s) updated`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });