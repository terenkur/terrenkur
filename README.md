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

The provided examples already contain working Supabase credentials.

3. Run the backend and frontend:

```bash
# In backend
npm start
# In frontend
npm run dev
```

## Deployment

 - **Render**: Create a new Web Service, set Node 18, and point it to the `backend/` folder. The backend has a no-op `build` script so you can keep the default build command `npm run build`.
- **Vercel**: Import the repository and set the project root to `frontend/`.
- **Supabase**: Apply `supabase/schema.sql` to initialize the database.

This setup provides a simple API route `/api/data` that reads from the `items` table in Supabase.
