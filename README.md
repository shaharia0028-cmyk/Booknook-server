# BookNook server

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm run dev`

Public: `GET /books`, `GET /books/latest`
Private (Better Auth JWT): `GET /books/mine`, `GET /books/:id`, `POST /books`, `PATCH /books/:id`, `DELETE /books/:id`, `POST /books/:id/borrow`, `GET /borrows/mine`, `DELETE /borrows/:id`

Login is handled by the Next.js app; this server only verifies the JWT using `CLIENT_URL/api/auth/jwks`.
