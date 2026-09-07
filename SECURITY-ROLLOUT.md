# Security rollout

## Required credential response

A tracked local environment file has been removed. Its previously committed secrets must still be revoked/replaced at their providers: Supabase service role key, Twitch client secret, ADMIN_TOKEN, YouTube API key, and RAWG API key. Deleting a file or rewriting Git history does not revoke a credential.

Coordinate the changes across Render and the Twitch bot deployment (including Fly.io or a local bot, if used). Never paste credentials into issues or commit them. Store them in service environment settings. After consumers use replacement credentials, verify the old credentials are revoked. Review existing moderator grants and profile ownership for changes made before this fix. History cleanup requires a separate coordinated rewrite; do not force-push over collaborators' work.

## Deploy and verify

1. Deploy backend before frontend. New endpoints `/api/me`, `/api/my-votes`, and `/api/twitch-rewards` use the Supabase bearer session and server-side ownership/role checks.
2. Set the Render build command to `npm ci && npm run build` and health check path to `/healthz`. The health endpoint checks the process, not database readiness.
3. Update scheduled calls to `/refresh-token` and `/refresh-token/donationalerts` to send `x-admin-token: <ADMIN_TOKEN>`. No browser should call these routes.
4. Confirm that the streamer token stored on the backend has the Twitch scopes needed for roles and rewards. `/api/streamer-token` is intentionally removed. Role information is returned by `/api/twitch-roles`; rewards by the moderator-only `/api/twitch-rewards`.
5. Test a normal Twitch login, first profile binding, voting, logout, moderator settings/rewards, and authenticated music playback. First binding resolves an immutable Twitch identity through Twitch; arbitrary nickname matching is rejected. Existing linked profiles are not renamed by vote submissions.
6. Frontend reads its profile and votes via the backend; no broad Supabase grants or RLS relaxation is required. Existing direct Realtime subscriptions remain subject to the project's RLS rules and are not opened by this patch.

`app_metadata` and server-managed user rows may grant moderator status. `user_metadata` never grants it. Server token rotation and database/Postgres upgrades are operational steps, not effects of merging this code.

## Local checks

Run `npm ci` and `npm test` in backend and frontend. Run `npm run typecheck` and `npm run build` in frontend. For a build without real credentials, use the placeholder variables shown in the GitHub workflow. Test files run through Jest; production TypeScript checking excludes test fixtures.
