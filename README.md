# Help My Barber

Tired of getting messed up by your barber? Help them out by generating reference images! Upload a picture, describe your cut, and get some pictures/angles to show your barber.

Uses Google's nano-banana 🍌 (Gemini-2.5-Flash-Image-Preview) model!

## 🚀 Deployment

I deployed the app using:

- **Backend:** [Railway](https://railway.app) - Rust/Axum API server
- **Frontend:** [Vercel](https://vercel.com) - Next.js web app

## Quick Start (Local)

1. **Get a [Gemini API key](https://aistudio.google.com/apikey)**

2. **Set up environment:**

   ```bash
   # Create backend .env file
   echo "GEMINI_API_KEY=your_key_here" > backend/.env
   echo "PORT=3001" >> backend/.env
   ```

3. **Run the app:**

   ```bash
   # Start backend (terminal 1)
   cd backend && cargo run

   # Start frontend (terminal 2)
   cd web && npm i && npm run dev
   ```

4. **Open http://localhost:3000** !
