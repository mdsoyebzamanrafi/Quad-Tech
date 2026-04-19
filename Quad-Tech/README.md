# Quad Tech (MERN E-Commerce)

Quad Tech is a MERN stack app with:
- Backend: Node.js + Express + MongoDB (`backend`)
- Frontend: React + Vite (`frontend`)

## Project structure
- `backend/` API server
- `frontend/` web client

## Prerequisites
- Node.js 20+ recommended
- npm
- MongoDB (local or Atlas) for full functionality

## Environment setup

### Backend (`backend/.env`)
Use these keys (this matches the current code):

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/quad_tech
JWT_SECRET=replace_with_a_long_random_secret

# Allows API server startup even when DB is down.
# Set to false in normal/full mode.
ALLOW_START_WITHOUT_DB=true

# Optional integrations
RECAPTCHA_SECRET_KEY=
GOOGLE_CLIENT_ID=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=Quad Tech
SMTP_FROM_EMAIL=
STRIPE_PUBLIC_KEY=
PAYPAL_CLIENT_ID=
```

Notes:
- `MONGO_URI` is the Mongo key used by the app.
- If `ALLOW_START_WITHOUT_DB=true`, server can start but DB-backed features (auth/orders/products persistence) will not work fully.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=
VITE_RECAPTCHA_SITE_KEY=
```

## Install dependencies
From repository root (`Quad-Tech`):

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Run locally
Use two terminals.

Terminal 1 (backend):
```powershell
cd backend
npm start
```

Terminal 2 (frontend):
```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:
- Frontend: `http://127.0.0.1:5173`
- Backend root: `http://127.0.0.1:5000/`
- Backend health: `http://127.0.0.1:5000/api/health`

## Integration checks
- Direct backend health:
```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing
```
- Through frontend -> backend path:
```powershell
Invoke-WebRequest http://127.0.0.1:5173/api/health -UseBasicParsing
```

## Security
- Do not commit real `.env` files.
- If any real keys were shared or exposed, rotate them.
