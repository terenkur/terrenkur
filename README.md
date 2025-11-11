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
channel:manage:redemptions
```
These scopes allow the frontend to check whether the user is a moderator, VIP or
subscriber of the configured channel. The `channel:manage:redemptions` scope is
required for retrieving channel point rewards in the settings page when
authorized as the streamer.

To avoid requesting these scopes from every viewer, generate a Twitch OAuth
refresh token for the streamer account and store it in the backend `.env` file
as `TWITCH_REFRESH_TOKEN`. The server keeps the current access token in the
`twitch_tokens` table and the `/api/streamer-token` endpoint reads from there
when `ENABLE_TWITCH_ROLE_CHECKS=true`. Supply your `TWITCH_CLIENT_ID` and
`TWITCH_SECRET` as well and set up a cron job that periodically calls
`/refresh-token` (e.g. `https://your-backend.example/refresh-token`) to refresh
the token before it expires.

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
  default build command `npm run build`. Add `TWITCH_REFRESH_TOKEN`, and if
  role checks are needed, set `ENABLE_TWITCH_ROLE_CHECKS=true` in the service's
  environment settings along with `TWITCH_CLIENT_ID` and `TWITCH_SECRET`. Run a
  cron job against `/refresh-token` to keep the access token updated.
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

## Streamer token refresh

When deployed on Render, the backend exposes a `https://<your-service>.onrender.com/refresh-token` endpoint (for example `https://terrenkur.onrender.com/refresh-token`) that refreshes the streamer’s Twitch access token. Schedule [EasyCron](https://www.easycron.com/) or a similar service to `GET` this URL every 3–4 hours.

The job requires `TWITCH_REFRESH_TOKEN`, `TWITCH_CLIENT_ID`, and `TWITCH_SECRET` to be configured in the backend environment. Only the dedicated streamer token is refreshed – regular user logins continue to use their own tokens and are unaffected.

## DonationAlerts token refresh

The backend exposes `POST /refresh-token/donationalerts` to rotate the DonationAlerts access token. Configure these environment variables in `backend/.env`:

```
DONATIONALERTS_CLIENT_ID=<client-id>
DONATIONALERTS_CLIENT_SECRET=<client-secret>
DONATIONALERTS_REFRESH_TOKEN=<refresh-token>
```

Trigger a refresh manually with:

```bash
curl -X POST https://<your-service>.onrender.com/refresh-token/donationalerts
```

To keep the token valid in production, schedule [cron-job.org](https://cron-job.org/) to `POST` this URL at a regular interval (for example, daily) and set the job to expect a `200` response status.

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

The `bot/` directory contains a simple Twitch chat bot for working with the
roulette via chat commands:

- `!игра <название>` (or `!game <name>`) — records your vote for the game if it exists in the active poll and you have votes left.
  - Example: `!игра Half-Life`
- `!игра список` — shows games in the active roulette with vote counts separated by `|`.
  - Example: `!игра список` → `Portal 2 - 3 | Doom - 1 | Half-Life - 0`
- `!игра голоса` — shows your remaining vote count (defaults to 1 if you're not registered).
  - Example: `!игра голоса` → `Твои голоса: 1`

### Running the bot

1. Install dependencies:
   ```bash
   cd bot && npm install
   ```
2. Copy the example environment file and fill in your credentials:
   ```bash
   cp bot/.env.example bot/.env
   ```
   Generate a Twitch Chat OAuth token for your bot account at
   [twitchapps.com/tmi](https://twitchapps.com/tmi/) (it starts with `oauth:`).
   Store this token securely (for example in your deployment's secret storage)
   so the bot process can authenticate with Twitch chat. The bot can also log
   channel point rewards, new followers and subs. To enable these features set
   the following variables in `bot/.env`:

   ```
   TWITCH_CLIENT_ID=your-client-id
   TWITCH_SECRET=your-client-secret
   TWITCH_CHANNEL_ID=your-channel-id
   # Optional comma separated list of reward IDs to log
   # These will be merged with IDs stored in the `log_rewards` table
   LOG_REWARD_IDS=id1,id2
   MUSIC_REWARD_ID=545cc880-f6c1-4302-8731-29075a8a1f17
   ```

   The bot also fetches reward IDs from the `log_rewards` table in Supabase at
   startup and refreshes them every minute. This allows adding or removing
   rewards without redeploying the bot.

   To mirror intimate (`intim_*`) and kiss (`poceluy_*`) alerts directly in OBS,
   configure the bundled WebSocket client by adding the following optional
   variables to `bot/.env`:

   ```
   # Host/port of the OBS WebSocket server (port defaults to 4455)
   OBS_WS_HOST=127.0.0.1
   OBS_WS_PORT=4455
   OBS_WS_PASSWORD=your-obs-password

   # Names of the OBS inputs that should be updated when an alert fires
   OBS_IMAGE_SOURCE_NAME=Overlay GIF Source
   OBS_AUDIO_SOURCE_NAME=Overlay Audio Source
   ```

   When these values are present the bot will pick a random matching entry from
   the `obs_media` table and update the configured inputs through OBS directly.
   The connection automatically reconnects with exponential backoff, and any
   failures are logged without blocking chat command handling.

  To mirror intimacy and kiss results in [Streamer.bot](https://streamer.bot)
  (for example to select different OBS media sources based on the outcome),
  configure its built-in HTTP server and set the optional variables below. The
  bot will call `POST /DoAction` on your Streamer.bot instance and forward the
  calculated type, initiator login and selected target as action arguments.

  ```
  STREAMERBOT_API_URL=http://localhost:7478
  STREAMERBOT_INTIM_ACTION=<action-name-or-id-for-!интим>
  STREAMERBOT_POCELUY_ACTION=<action-name-or-id-for-!поцелуй>
  ```

  Specify either the action name or its GUID for each command. Leave the
  corresponding value empty to disable the integration for that command. If you
  want to map specific `intim_*`/`poceluy_*` outcomes to dedicated actions,
  provide the optional `SB_INTIM_*` and `SB_POCELUY_*` variables (see
  `shared/streamerBotActions.js` for the exhaustive list). Each variable accepts
  an action GUID or name, while `SB_INTIM___DEFAULT` and `SB_POCELUY___DEFAULT`
  can override the fallback action for their respective command groups.

  Every chat response is now relayed to Twitch through Streamer.bot. The bot
  resolves the action GUIDs defined in
  [`shared/streamerBotChatActions.js`](shared/streamerBotChatActions.js) and
  triggers the corresponding actions with the chat message, the initiating
  login, and optional `target`/`type` arguments. Configure the required
  environment variables (for example `SB_CHAT_CLIP`, `SB_CHAT_POLL_HELP`,
  `SB_CHAT_INTIM`, `SB_CHAT_POCELUY`, etc.) so that each scenario points to a
  valid Streamer.bot action capable of posting to chat.

   Mix It Up makes the arguments string available to overlay scripts in several
   different ways depending on the version and browser environment. A defensive
   example script that normalises the argument payload (including the
   `type|initiator|target` format sent by the bot) is provided in
   [`docs/mixitup-overlay-script.js`](docs/mixitup-overlay-script.js). Drop the
   file into a "Script" overlay layer and it will emit a JSON object with the
   parsed values via `sendParentMessage` for use in other overlay components.

3. Start the bot:
   ```bash
   npm start
   ```

### Deploying the bot to Fly.io

The repository includes a `Dockerfile` and `fly.toml` for deploying the bot on
[Fly.io](https://fly.io) using Docker:

1. Initialize the Fly application (creates `fly.toml` if it doesn't exist):
   ```bash
   fly launch --no-deploy
   ```
2. Configure the required secrets for your environment:
   ```bash
   fly secrets set SUPABASE_URL=... SUPABASE_KEY=... BOT_USERNAME=... TWITCH_CHANNEL=...
   ```
   Chat OAuth tokens are no longer required: all outgoing chat messages are
   dispatched via Streamer.bot.
3. Deploy the bot:
   ```bash
   fly deploy
   ```

## License

This project is licensed under the [MIT License](LICENSE).
