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

1. Install Node.js dependencies (requires internet access):

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Create a `.env` file in `backend/` with your Supabase credentials:

```
SUPABASE_URL=your_url
SUPABASE_KEY=service_role_key
PORT=3001
```

3. Run the backend and frontend:

```bash
# In backend
npm start
# In frontend
npm run dev
```

## Deployment

- **Render**: Create a new Web Service and point it to the `backend/` folder.
- **Vercel**: Import the repository and set the project root to `frontend/`.
- **Supabase**: Apply `supabase/schema.sql` to initialize the database.

This setup provides a simple API route `/api/data` that reads from the `items` table in Supabase.
