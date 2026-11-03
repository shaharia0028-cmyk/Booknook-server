# BookNook Server

The REST API behind [BookNook](https://booknook-rose.vercel.app), a community library where readers share, borrow and return books. Built with Express, TypeScript and MongoDB.

Client app: https://booknook-rose.vercel.app

## Features

- **JWT protection:** Private routes need a Better Auth token in the `Authorization: Bearer <token>` header. The token is verified with the JWKS endpoint of the Next.js app (`CLIENT_URL/api/auth/jwks`), and its signature, issuer, audience, algorithm and expiry are all checked.
- **Owner-only changes:** The owner of a book comes from the verified token, never from the request body, and only the owner can edit or delete a book.
- **Search, filter and pagination:** `GET /books` supports `search`, `category`, `ownerId`, `page` and `limit`, and is sorted newest first.
- **Safe borrowing:** A copy is taken only if one is left, so two people cannot borrow the last copy. Each person can borrow a book once, and returning it gives the copy back.
- **Input validation:** Titles, categories, image URLs and copy counts are validated on the server before anything is saved.
- **Serverless ready:** Works on Vercel with a reused MongoDB connection.

## API routes

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/` | Public | Health check |
| GET | `/books` | Public | List books. Query: `search`, `category`, `ownerId`, `page`, `limit` |
| GET | `/books/:id` | Private | Get one book |
| POST | `/books` | Private | Add a book |
| PATCH | `/books/:id` | Private (owner) | Edit a book |
| DELETE | `/books/:id` | Private (owner) | Delete a book that is not borrowed |
| POST | `/borrows` | Private | Borrow a book for 7 days. Body: `{ "bookId": "..." }` |
| GET | `/borrows` | Private | Books borrowed by the signed-in user |
| DELETE | `/borrows/:id` | Private | Return a borrowed book |

## Tech stack

Express 5, TypeScript, MongoDB driver, jose (JWT and JWKS verification), CORS, dotenv.

## Run it locally

1. Install the packages:
   ```bash
   npm install
   ```
2. Create a `.env` file in this folder:
   ```env
   PORT=8000
   MONGODB_URI=your-mongodb-connection-string
   MONGODB_DB=booknook
   CLIENT_URL=http://localhost:3000
   ```
   Use the same `MONGODB_URI` and `MONGODB_DB` as the client, because the scripts below read the Better Auth `user` collection. `CLIENT_URL` must be the same origin as `BETTER_AUTH_URL` in the client.
3. Start the server:
   ```bash
   npm run dev
   ```
   It runs on http://localhost:8000.

## Scripts

- `npm run dev`: start with auto-reload
- `npm run build` and `npm start`: build and run the compiled server
- `npm run typecheck`: check the TypeScript types
- `npm run seed -- you@example.com "Your Name"`: add sample books for a registered user
- `npm run migrate-owner-ids`: one-time script that adds `ownerId` / `userId` to older books and borrows. Run it once before deploying the version that checks ownership by user id.

## Deploy on Vercel

Set `MONGODB_URI`, `MONGODB_DB` and `CLIENT_URL` (the live client URL, with no trailing path) in the project settings. Redeploy after changing any of them.