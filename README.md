# Help My Barber

AI-powered haircut visualization using Google's Gemini API.

## Quick Start

```bash
# Backend
cd backend
cargo run

# Frontend (new terminal)
cd web
npm install
npm run dev
```

Open `http://localhost:3000` and upload a photo to get AI haircut suggestions.

## Setup

1. Get a [Gemini API key](https://aistudio.google.com/)
2. Create `backend/.env`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the commands above
