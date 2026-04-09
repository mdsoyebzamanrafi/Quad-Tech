# Quad Tech E-Commerce Application

Quad Tech is a full-stack MERN (MongoDB, Express, React, Node.js) e-commerce web application. 

This repository contains both the React frontend and the Express backend, structured to provide a scalable and maintainable e-commerce solution with dynamic UI, product management, cart functionality, and database integration.

## Project Structure

This is a monorepo setup containing both the client and server side code:
- `/frontend`: The Vite+React application. Responsible for the user interface, shopping cart context, and routing.
- `/backend`: The Express.js server. Responsible for RESTful APIs, database models (Mongoose), and business logic.
- `/`: Root directory contains global configuration files like `.gitignore` and `netlify.toml` for deployment.

## Features

- **Responsive Frontend**: Built with React, Vite, and custom CSS for a modern, playful, yet luxurious feel with Dark Mode support.
- **Robust Backend**: Node.js and Express handling API requests.
- **Database**: MongoDB integration via Mongoose (Models for User, Product, and Order).
- **Security**: JWT-based authentication and Bcrypt password hashing.
- **Deployment Ready**: Fully configured for Netlify (frontend) and ready to be hosted on platforms like Render (backend).

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Local MongoDB or MongoDB Atlas URI.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` folder.
    ```bash
    cd backend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create a `.env` file in the `backend/` directory with the following variables:
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    NODE_ENV=development
    ```
4. (Optional) Feed the database with sample products and users:
    ```bash
    npm run data:import
    ```
5. Start the backend development server:
    ```bash
    npm run dev
    ```
    *The server will run on `http://localhost:5000`.*

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory.
    ```bash
    cd frontend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start the Vite development server:
    ```bash
    npm run dev
    ```
    *The application will run on `http://localhost:5173`.*

---

## Deployment

### Frontend (Netlify)
This repository contains a `netlify.toml` file at its root. 
1. Import this repository into Netlify.
2. Netlify will automatically detect the build settings (`frontend` as base directory, `npm run build` as command, and `dist` as publish directory) and deploy the React application.

### Backend (Render / Railway)
1. Deploy the `backend` directory to a Node.js hosting provider.
2. Ensure you configure your production Environment Variables (e.g., `MONGO_URI`, `JWT_SECRET`) on the hosting provider's dashboard.
3. Update the frontend API endpoint (`frontend/src/utils/api.js` or `.env`) to point to the live backend URL.
