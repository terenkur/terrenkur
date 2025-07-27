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

If you want to use the playlists feature, also set your YouTube API key and the
channel ID in both `.env` files:

```
YOUTUBE_API_KEY=your-api-key
YOUTUBE_CHANNEL_ID=your-channel-id
```

If you want moderators to search the RAWG database when adding games, also set
your RAWG API key in both `.env` files:

```
RAWG_API_KEY=your-rawg-key
```

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

### Creating a new roulette

Use the “New Roulette” button on the `/archive` page to open `/new-poll` and build a new roulette. The builder is visible only to moderator accounts. When confirming, moderators can choose whether the existing roulette is archived.

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
The `games` table now also stores `background_image` URLs for thumbnails.

Moderators can toggle accepting votes and vote editing via the `/api/accept_votes` and `/api/allow_edit` endpoints (also available in the Settings modal). When voting is closed or editing disabled, the frontend disables the vote controls.

To see the current poll visualized as a spinning wheel, open the homepage. Games are eliminated from the wheel one by one as it spins until a final winner remains. This does not remove anything from the database; it's only a visual way to pick a random game.

Archived roulettes now store the elimination order and the winning game. When viewing an entry in the archive you will see the full elimination sequence and a button to replay the wheel using the recorded seed so the spins reproduce exactly.

With a YouTube API key configured you can also visit `/playlists` to see videos from your channel grouped by tags extracted from their descriptions.

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

After updating to include the `background_image` column, run the schema file
again so the table is altered in Supabase.


## Twitch Chat Bot

The `bot/` directory contains a simple Twitch chat bot that listens for the
command `!игра <название>` (or `!game <name>`). When triggered, the bot checks
whether the game exists in the active poll and records the user's vote if they
have remaining votes.

### Running the bot

1. Install dependencies:
   ```bash
   cd bot && npm install
   ```
2. Copy the example environment file and fill in your credentials:
   ```bash
   cp bot/.env.example bot/.env
   ```
3. Start the bot:
   ```bash
   npm start
   ```
