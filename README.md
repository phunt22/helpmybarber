# Help My Barber

AI-powered haircut visualization using Google's Gemini API.

## Quick Start (Local Development)

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

1. Get a [Gemini API key](https://aistudio.google.com/apikey)
2. Create `backend/.env`:
   ```
   GEMINI_API_KEY=your_key_here
   PORT=3001
   ```
3. Run the commands above

## 🚀 **FREE Deployment** (No Domain Cost!)

### **Step 1: Deploy Backend to Railway**

1. **Go to [railway.app](https://railway.app)** and sign up with GitHub
2. **Create new project** → "Deploy from GitHub repo"  
3. **Select your repository** - Railway auto-detects Rust projects
4. **Add environment variables** in your project dashboard:
   - `GEMINI_API_KEY` = `your_gemini_api_key_here`
   - `PORT` = `3001`
5. **Deploy!** 🚀 You'll get a URL like: `https://backend-production-xxxx.up.railway.app`

### **Step 2: Deploy Frontend to Vercel**

1. **Go to [vercel.com](https://vercel.com)** and sign up with GitHub
2. **Import project** → Select your repository
3. **Configure build settings**:
   - Framework: Next.js  
   - Root Directory: `web`
   - Build Command: `npm run build`
4. **Add environment variable**:
   - `NEXT_PUBLIC_API_URL` = `https://your-railway-backend-url.up.railway.app`
5. **Deploy!** 🎉 You'll get a URL like: `https://helpmybarber.vercel.app`

### **Step 3: Test Your App**

Visit your Vercel URL and upload a photo to test the complete flow!

---

## 💰 **Cost: $0/month** 
- Railway free tier: 500 hours/month
- Vercel free tier: Unlimited bandwidth
- Your URLs: `yourapp.vercel.app` + `yourbackend.up.railway.app`

## 🎯 **Free Tier Limits**
- Railway: 500 execution hours/month (plenty for most apps)
- Vercel: 100GB bandwidth, 1000 serverless function invocations
- Both include HTTPS and global CDN automatically
