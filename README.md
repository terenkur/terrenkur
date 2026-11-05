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
Moderator accounts use email and password; see [Moderator access](MODERATOR-ACCESS.md). Set `NEXT_PUBLIC_BACKEND_URL` to the backend URL (`http://localhost:3001` locally). Twitch credentials are used only by server integrations.

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
For server-side channel integration, generate a Twitch OAuth
refresh token for the streamer account and store it in the backend `.env` file
as `TWITCH_REFRESH_TOKEN`. The server keeps the current access token in the
`twitch_tokens` table. Supply your `TWITCH_CLIENT_ID` and
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

### Music queue playback

- Moderators can open `/music-queue` to see the current track, upcoming requests and control playback in a YouTube embed. The page listens for live updates via `GET /api/music-queue/events` and only allows one active item at a time.

#### Video-only player

- For unattended playback, generate a dedicated token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Set the result as `MUSIC_QUEUE_PLAYER_TOKEN` in the **backend** environment and restart/redeploy the backend. Do not add it to frontend environment variables or commit it.
- Open `https://YOUR-SITE/player#token=YOUR_TOKEN` (or `/music-queue/player#token=YOUR_TOKEN`) in the playback browser/OBS source. No moderator login or interaction with the page is needed for queue access. Enable automatic playback separately in `/music-queue` and keep one controlling player open. Without a link token, a moderator session still works.
- The token is sent to the backend in a dedicated header, not a query string. It grants music playback and the OBS control panel (pause, volume, mute, queue autostart, skip active track and replay history). It cannot access unrelated moderator settings. Treat the link as a password. Replacing the backend token and restarting/redeploying revokes old links, including their next playback mutation. The same value must be configured on all backend instances.
- The player shows only video filling the viewport, with a transparent background while waiting for requests. It advances on completion, skips unavailable/unsupported videos, and reconciles playback and queue state every two seconds as well as on live events and reconnection (five seconds after failures).
- For a display that cannot be clicked, configure the host browser/source to allow autoplay with sound and use its fullscreen/kiosk mode or size the OBS browser source to fill the scene. A link token grants backend access; it cannot override browser autoplay/fullscreen restrictions. In an interactive browser, clicking the surface (or pressing Enter/Space while focused) remains an optional fallback. YouTube may display its own branding or overlays.
- Sessions without a valid link or moderator login cannot start, complete or skip requests. Diagnostics are written to the browser console; failed videos use the existing `skipped` queue status.

#### OBS music control dock

- Add `https://YOUR-SITE/player/control#token=YOUR_TOKEN` as a custom browser dock in OBS. Use the same token as the separate `/player` browser source. The panel is designed for widths around 280–420 px and does not play audio itself.
- Controls: pause/resume, skip the active song, volume, mute, queue autostart, queue list, and replay from the last 20 history entries. Replay creates a new request at the end of the queue and preserves the original history entry; it does not interrupt the active song. Skipping while autostart is disabled leaves the player waiting.
- Pause, volume and mute persist in the existing `settings` table; no migration is required. Deploy both backend and frontend. Keep only one playback source active; multiple docks can control that same source.
- The player reads commands every two seconds and reports its actual YouTube state every five seconds. The dock shows the reported state, pending acknowledgement, and an offline indication after 15 seconds without reports. A connected player that remains in “waiting for playback” may be blocked by browser autoplay policy. Remote resume cannot grant a browser autoplay permission.
- The dock also reports YouTube API connection failures, iframe initialization timeouts, autoplay blocks and YouTube error codes. Confirmation waiting is capped at 15 seconds before showing a troubleshooting message. If OBS logs contain `YouTube API timeout` or `YouTube API unavailable`, check DNS/network access to `www.youtube.com` from the OBS computer; a working backend/token does not establish YouTube connectivity. The player retries initialization automatically without skipping the queue.
- The backend exposes endpoints to mark tracks as started, completed or skipped.
- Add the playback page URL to your moderator bookmarks – the navigation will only show it after logging in with a moderator account.

## Deployment

- **Render**: Create a new Web Service, set Node 18, and point it to the
  `backend/` folder. The backend has a no-op `build` script so you can keep the
  default build command `npm run build`. Add `TWITCH_REFRESH_TOKEN`
  in the service's environment settings along with `TWITCH_CLIENT_ID` and `TWITCH_SECRET`. Run a
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

When deployed on Render, the backend exposes a `https://<your-service>.onrender.com/refresh-token` endpoint (for example `https://terrenkur.onrender.com/refresh-token`) that refreshes the streamer’s Twitch access token. Schedule [EasyCron](https://www.easycron.com/) or a similar service to `GET` this URL every 3–4 hours with the `x-admin-token` header set to `ADMIN_TOKEN`.

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
curl -X POST -H "x-admin-token: <ADMIN_TOKEN>" https://<your-service>.onrender.com/refresh-token/donationalerts
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


## License

This project is licensed under the [MIT License](LICENSE).

See [SECURITY-ROLLOUT.md](SECURITY-ROLLOUT.md) before deploying the security update.
