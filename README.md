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

The provided examples now use placeholder Supabase credentials. Replace them
with your own values. **For production builds the frontend requires `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be defined** or the Next.js build will fail.
If you plan to enable Twitch login, add your Twitch OAuth
keys and redirect URLs as shown
below. Set `TWITCH_CLIENT_ID` and `TWITCH_SECRET` in the backend and
`NEXT_PUBLIC_TWITCH_CHANNEL_ID` in the frontend. The frontend also needs `NEXT_PUBLIC_BACKEND_URL` pointing to your
backend. For local development it should be `http://localhost:3001`.

The backend accepts a comma-separated `FRONTEND_URLS` variable to configure
allowed origins for CORS. If omitted, requests from any origin are permitted.

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
NEXT_PUBLIC_TWITCH_CHANNEL_ID=your-channel-id
```
Configure the same URLs in the Supabase dashboard for both local development
and production. The app requests the following Twitch OAuth scopes for normal
logins:

```
user:read:email
moderation:read
channel:read:vips
channel:read:subscriptions
```
The streamer can use the "Streamer login" option to grant the additional scope:

```
channel:read:redemptions
```
These allow the frontend to check whether the user is a moderator, VIP or
subscriber of the configured channel and fetch channel point rewards when
authorized as the streamer.

To avoid requesting these scopes from every viewer, generate a Twitch OAuth
token for the streamer account (for example via https://twitchapps.com/tmi/)
and store it in the backend `.env` file as `TWITCH_STREAMER_TOKEN`. The
`/api/streamer-token` endpoint is disabled by default; set
`ENABLE_TWITCH_ROLE_CHECKS=true` alongside `TWITCH_STREAMER_TOKEN` to enable it.
When deploying to Render or another hosting platform, set these environment
variables there as well.

3. Run the backend and frontend:

```bash
# In backend
npm start
# In frontend
npm run dev
```

## Running tests

```bash
cd backend && npm test
cd ../frontend && npm test
```

### Creating a new roulette

Use the “New Roulette” button on the `/archive` page to open `/new-poll` and build a new roulette. The builder is visible only to moderator accounts. When confirming, moderators can choose whether the existing roulette is archived.

## Deployment

- **Render**: Create a new Web Service, set Node 18, and point it to the
  `backend/` folder. The backend has a no-op `build` script so you can keep the
  default build command `npm run build`. Add `TWITCH_STREAMER_TOKEN` and, if
  role checks are needed, set `ENABLE_TWITCH_ROLE_CHECKS=true` in the service's
  environment settings along with other required variables.
- **Vercel**: Import the repository, set the project root to `frontend/`, and add
  `NEXT_PUBLIC_BACKEND_URL` in the environment variables (e.g.
  `https://terrenkur.onrender.com`).
- **Supabase**: Apply `supabase/schema.sql` to initialize the database.

This setup provides a simple API route `/api/data` that reads from the `items` table in Supabase.
The `/api/get-stream` endpoint proxies requests to the Twitch Helix API using your server's `TWITCH_CLIENT_ID`.
The `/auth/twitch-token` endpoint exchanges a Twitch OAuth `code` for access and refresh tokens using `TWITCH_CLIENT_ID`, `TWITCH_SECRET` and `OAUTH_CALLBACK_URL`.
The `/api/poll` endpoint aggregates votes for each game and now also includes the usernames of voters.
The `/api/poll/:id` endpoint returns results for a specific poll and `/api/polls` lists all polls.
Games are linked to polls through the new `poll_games` table defined in `supabase/schema.sql`.
The `games` table now also stores `background_image` URLs for thumbnails.
The `/api/games/:id` endpoint returns details for a single game including
its initiators and a list of roulettes with the voters for that game.
The `/api/logs` endpoint returns recent entries from the `event_logs` table.
Pass a numeric `limit` between 1 and 100 to control how many entries are
returned.
The `/api/stats/popular-games`, `/api/stats/top-voters` and
`/api/stats/game-roulettes` endpoints aggregate statistics across all roulettes.

Moderators can toggle accepting votes and vote editing via the `/api/accept_votes` and `/api/allow_edit` endpoints (also available in the Settings modal). When voting is closed or editing disabled, the frontend disables the vote controls.

To see the current poll visualized as a spinning wheel, open the homepage. Games are eliminated from the wheel one by one as it spins until a final winner remains. This does not remove anything from the database; it's only a visual way to pick a random game.

Archived roulettes now store the elimination order and the winning game. When viewing an entry in the archive you will see the full elimination sequence and a button to replay the wheel using the recorded seed so the spins reproduce exactly.

With a YouTube API key configured you can also visit `/playlists` to see videos from your channel grouped by tags extracted from their descriptions.
The `/stats` page visualizes the most popular games, top voters and the number of roulettes each game has appeared in using these aggregated counts.

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
   The bot can also log channel point rewards, new followers and subs.
   To enable these features set the following variables in `bot/.env`:

   ```
   TWITCH_CLIENT_ID=your-client-id
   TWITCH_SECRET=your-client-secret
   TWITCH_CHANNEL_ID=your-channel-id
   # Optional comma separated list of reward IDs to log
   # These will be merged with IDs stored in the `log_rewards` table
   LOG_REWARD_IDS=id1,id2
   ```

   The bot also fetches reward IDs from the `log_rewards` table in Supabase at
   startup and refreshes them every minute. This allows adding or removing
   rewards without redeploying the bot.

3. Start the bot:
   ```bash
   npm start
   ```

## License

This project is licensed under the [MIT License](LICENSE).
