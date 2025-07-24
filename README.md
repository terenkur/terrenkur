# Terrenkur Starter

This repository contains a minimal full-stack setup using:

- **Backend**: Express.js ready to deploy on Render
- **Frontend**: Next.js ready to deploy on Vercel
- **Database**: Supabase SQL schema

## Structure

```
backend/   - Express API with Supabase client
frontend/  - Next.js application
supabase/  - SQL schema for the database
```

## Local development

Requires Node.js 18 or newer.

1. Install Node.js dependencies (requires internet access):

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Copy the sample env files and adjust if needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

The provided examples already contain working Supabase credentials. If you plan
to enable Twitch login, add your Twitch OAuth keys and redirect URLs as shown
below. The frontend also needs `NEXT_PUBLIC_BACKEND_URL` pointing to your
backend. For local development it should be `http://localhost:3001`.

```
TWITCH_CLIENT_ID=your-client-id
TWITCH_SECRET=your-client-secret
```
Configure the same URLs in the Supabase dashboard for both local development
and production.

3. Run the backend and frontend:

```bash
# In backend
npm start
# In frontend
npm run dev
```

## Deployment

 - **Render**: Create a new Web Service, set Node 18, and point it to the `backend/` folder. The backend has a no-op `build` script so you can keep the default build command `npm run build`.
- **Vercel**: Import the repository, set the project root to `frontend/`, and add
  `NEXT_PUBLIC_BACKEND_URL` in the environment variables (e.g.
  `https://terrenkur.onrender.com`).
- **Supabase**: Apply `supabase/schema.sql` to initialize the database.

This setup provides a simple API route `/api/data` that reads from the `items` table in Supabase.
The `/api/poll` endpoint aggregates votes for each game and now also includes the usernames of voters.
The `/api/poll/:id` endpoint returns results for a specific poll and `/api/polls` lists all polls.
Games are linked to polls through the new `poll_games` table defined in `supabase/schema.sql`.

To see the current poll visualized as a spinning wheel, open the homepage. Games are eliminated from the wheel one by one as it spins until a final winner remains. This does not remove anything from the database; it's only a visual way to pick a random game.

## Updating the Supabase schema

If you modify `supabase/schema.sql` (for example to add a column like `slot`), reapply the file to your Supabase database so it stays in sync:

```bash
psql "$SUPABASE_URL" -f supabase/schema.sql
```

Where `$SUPABASE_URL` is your database connection string.

If your database already contains the `votes_user_poll_unique` index from an
earlier version of the schema, drop it before reapplying:

```bash
psql "$SUPABASE_URL" -c "DROP INDEX IF EXISTS votes_user_poll_unique"
```

