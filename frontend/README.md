This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Environment variables

Before running the app or building for production, copy `.env.example` to `.env.local` and
set the required values. The build step (`npm run build`) relies on variables such as
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` being defined.
See `.env.example` for the full list. Set `NEXT_PUBLIC_ENABLE_TWITCH_ROLES=true`
to enable Twitch role fetching and the streamer login menu; it defaults to
`false`.

### Streamer token

Some Twitch role checks require elevated scopes such as `moderation:read`,
`channel:read:vips` and `channel:read:subscriptions`. Instead of requesting
these scopes from every viewer, the application can use a dedicated streamer
token. The backend exposes `/api/streamer-token`, which should return a Twitch
access token for the channel owner with the scopes listed above.

Obtain a token by authorizing the streamer account with the Twitch OAuth flow
including those scopes and store the resulting access token in a secure place,
for example the `TWITCH_STREAMER_TOKEN` environment variable used by the
backend. Refresh or replace the token when it expires.

### Manual auth callback test

1. Run the app with `npm run dev` and start the login flow.
2. After being redirected back to `/auth/callback`, verify the URL contains a `code` parameter.
3. Check `localStorage` for a key starting with `sb-cv-` – it stores the `code_verifier` used for PKCE.
4. If both values exist, the app should redirect to `/` and create a session without a 400 error.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
