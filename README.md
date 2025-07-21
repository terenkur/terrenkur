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

### Database schema

The included `supabase/schema.sql` file creates the following tables:

- `items` – basic example data
- `users` – voters identified by a nickname
- `games` – list of games to vote on
- `polls` – each poll instance
- `votes` – records of user votes for games in a poll

You can create the schema using the Supabase SQL editor or with the Supabase CLI:

```bash
supabase db push supabase/schema.sql
```

If you prefer `psql`, pass your database connection string and run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

### API endpoints

- `GET /api/data` – returns rows from the `items` table
- `GET /api/poll` – fetches the latest poll with vote counts per game
- `POST /api/vote` – record a vote `{ poll_id, game_id, nickname }`

### Frontend

In addition to the default home page, a new page is available at `/poll` which displays the latest poll and allows voting. During local development visit `http://localhost:3000/poll`. After deploying the frontend on Vercel the page will be accessible at `https://<your-vercel-domain>/poll`.
