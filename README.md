# Quad Tech - Luxury E-Commerce Platform

Welcome to **Quad Tech**, a premium e-commerce platform built with the MERN stack (MongoDB, Express, React, Node.js). Quad Tech focuses on showcasing technology products with a dynamic, vibrant design, utilizing sleek glassmorphism effects, intelligent search, and robust security protocols.

---

## 🎯 Architecture & Design Rationale

### The Frontend (React, Vite)
*   **Aesthetics First**: Rather than relying on rigid frameworks like TailwindCSS or Bootstrap, the frontend utilizes **Custom Vanilla CSS**. This allows for the high-end "Apple-like" layout, complex layered micro-animations, floating blobs, and dynamic theme switching (Light/Dark Mode). 
*   **Search & Suggestions**: Includes a powerful and debounced case-insensitive search engine on the frontend that seamlessly communicates with the backend, allowing instant keyword filtering and dynamic category routing.
*   **Security Integration**: Fully integrates **Google Identity Services (OAuth2)** via a custom premium UI and robust **Google reCAPTCHA v2** for form protection against scraping and bot-automation.

### The Backend (Node.js, Express, MongoDB)
*   **Token-Based API**: Uses signed JWTs to securely map sessions to the database.
*   **Modular Architecture**: Built with distinct `Routes`, `Controllers`, and `Middleware` architecture. It strictly controls API exposure (e.g. limiting product queries effectively).
*   **Authentication & OTP**: Incorporates email confirmation via `nodemailer`, handling registration verification and secure "Forgot Password" workflows.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
*   Node.js installed (v16+)
*   MongoDB Atlas Account (or local MongoDB running)
*   Google Cloud Console Account (for OAuth maps and reCAPTCHA)

### 1. Clone the repository
```bash
git clone https://github.com/mdsoyebzamanrafi/Quad-Tech.git
cd Quad-Tech
```

### 2. Setup the Backend
Open a new terminal and prepare the backend server.
```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:
```env
# Server Port
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/tigertech

# JWT Secret Key
JWT_SECRET=your_super_secret_jwt_key

# Nodemailer Credentials (for OTPs)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# Google reCAPTCHA
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

Run the backend server:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a separate terminal and prepare the React frontend.
```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:
```env
# Set to your backend URL when deployed (e.g., https://your-backend.onrender.com)
VITE_API_URL=

# Google Project Keys
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Run the frontend server:
```bash
npm run dev
```

_Note on console messages: If you see "injecting react-refresh" or console startup data, know this is just `Vite` enabling Hot-Module Replacement in development mode. It will not be present in your production build._

---

## 🌍 Pushing to GitHub & Deployment Setup

Once you're satisfied with local tests, follow these steps to securely configure your repository and deploy absolutely for free.

### Phase 1: Push to GitHub
1. Create a brand new, empty repository on GitHub.
2. Ensure you are at the absolute root of this project (`c:\Drive\Brac\Tiger-Tech`).
3. Run the following:
```bash
git init
git add .
git commit -m "Initialize Quad Tech E-Commerce Project"
git branch -M main
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```
_Note: Because of the `.gitignore` setup, your `.env` files and `node_modules` will automatically be excluded. Keep your keys safe!_

### Phase 2: Deploy Backend to Render (Free Tier)
We use [Render](https://render.com) for the backend because it natively supports Node.js web services completely free.
1. Sign in to Render and click **New -> Web Service**.
2. Connect your GitHub and select the repository you just created.
3. Configure settings:
   *   **Name**: `quad-tech-backend`
   *   **Root Directory**: `backend` (Important!)
   *   **Environment**: `Node`
   *   **Build Command**: `npm install`
   *   **Start Command**: `npm start`
4. Expand **Environment Variables** and add *every* key from your `backend/.env` file.
5. Click **Deploy Web Service**.
6. Once deployed, copy your generated Render URL (e.g., `https://quad-tech-backend.onrender.com`).

### Phase 3: Deploy Frontend to Netlify (Free Tier)
We use [Netlify](https://netlify.com) for the frontend because it seamlessly serves optimized React (Vite) builds globally.
1. Sign in to Netlify and click **Add New Site -> Import an existing project**.
2. Connect GitHub and select your repository.
3. Configure settings:
   *   **Base Directory**: `frontend` (Important!)
   *   **Build Command**: `npm run build`
   *   **Publish Directory**: `frontend/dist`
4. Click **Advanced build settings -> New variable** and add:
   *   `VITE_API_URL`: *The Render URL you copied earlier*
   *   All other `VITE_` variables from your `frontend/.env`.
5. Click **Deploy Site**.

*Note: We have already included a `public/_redirects` file that tells Netlify how to perfectly handle our complex React Router maps, so pages won't crash when manually refreshing!*
