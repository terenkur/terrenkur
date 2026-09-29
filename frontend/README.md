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

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Environment variables

Before running the app or building for production, copy `.env.example` to `.env.local` and
set the required values. The build step (`npm run build`) relies on variables such as
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` being defined.
See `.env.example` for the full list. Set `NEXT_PUBLIC_ENABLE_TWITCH_ROLES=true`
on the frontend and `ENABLE_TWITCH_ROLE_CHECKS=true` in the backend to enable
Public Twitch role information; they default to `false`.

### Server-side Twitch roles

Streamer credentials remain on the backend. The frontend reads roles and avatars
from `/api/twitch-roles` and moderators read rewards from `/api/twitch-rewards`
using their Supabase session. Enable `NEXT_PUBLIC_ENABLE_TWITCH_ROLES=true` in
the frontend and `ENABLE_TWITCH_ROLE_CHECKS=true` on the backend for roles.
The backend streamer token must have the required Twitch scopes.

Scheduled refresh requests must send the `x-admin-token` header. The former
public `/api/streamer-token` endpoint has been removed. See
[the rollout guide](../SECURITY-ROLLOUT.md) for deployment and credential rotation.

### Moderator access

Open `/moderator` to sign in with a staff email and password. There is no public registration. See [setup](../MODERATOR-ACCESS.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
