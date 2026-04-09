# Quad Tech E-Commerce Application - Setup Guide

Welcome to the Quad Tech E-Commerce Application repository! This document provides a **hyper-detailed, step-by-step guide** on how to get this full-stack MERN (MongoDB, Express, React, Node.js) application running on a completely new computer. 

Please follow these instructions sequentially to avoid any environment or dependency errors.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Cloning the Repository](#2-cloning-the-repository)
3. [Environment Variables Setup](#3-environment-variables-setup)
4. [Backend Setup & Database Seeding](#4-backend-setup--database-seeding)
5. [Frontend Setup](#5-frontend-setup)
6. [Running the Application](#6-running-the-application)
7. [Troubleshooting Guide](#7-troubleshooting-guide)

---

## 1. Prerequisites

Before touching the code, ensure your computer has the correct foundational software installed.

### Install Node.js
This application relies on Node.js to execute JavaScript code outside of a web browser.
1. Download Node.js from [nodejs.org](https://nodejs.org/). (We recommend the **LTS** version).
2. Install it using the default settings.
3. Verify the installation by opening your terminal (Command Prompt, PowerShell, or Terminal on macOS/Linux) and typing:
   ```bash
   node -v
   npm -v
   ```
   *Both commands should return a version number.*

### Verify Git Installation
Git is required to pull the source code.
1. Download from [git-scm.com](https://git-scm.com/).
2. Verify installation: `git --version`

---

## 2. Cloning the Repository

1. Open your terminal and navigate to the directory where you want to keep the project folder. For example, to navigate to your Documents folder:
   ```bash
   cd Documents
   ```
2. Clone the repository to your local machine:
   ```bash
   git clone <URL_TO_YOUR_GIT_REPOSITORY> 
   # Example: git clone https://github.com/your-username/quad-tech-ecommerce.git
   ```
3. Navigate into the newly created root folder:
   ```bash
   cd "E-Commerce Web Application" 
   # (or whatever name the root folder was given)
   ```

---

## 3. Environment Variables Setup

The application needs connection strings and secret keys to function properly. We keep these hidden in a `.env` file that is normally ignored by Git. You must create this file manually.

1. Navigate into the **backend** folder:
   ```bash
   cd backend
   ```
2. Create a new file named exactly `.env` (don't forget the dot at the beginning).
3. Open this `.env` file in your code editor (like VS Code) and paste exactly the following variables:

   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://universal:AbRaSaRu1234@quadtechcluster.zucvhs6.mongodb.net/ecommerce-app?retryWrites=true&w=majority&appName=QuadTechCluster
   JWT_SECRET=YOUR_RANDOM_SECRET_KEY
   NODE_ENV=development
   ```
   > **Note:** The `MONGO_URI` provided connects to a cloud-hosted MongoDB Atlas Cluster. No local database installation is necessary!

---

## 4. Backend Setup & Database Seeding

Now we must install the Node packages required by the backend and populate the database with initial dummy data.

1. Ensure you are still inside the `backend` folder in your terminal (`.../E-Commerce Web Application/backend`).
2. Run the Node Package Manager install command to download all dependencies:
   ```bash
   npm install
   ```
   *Note: This might take a minute. Look closely at the terminal; if it says "audited X packages", it was successful.*
3. Now, you need to populate your MongoDB database with sample Admin Users and Products so the application has data to display. Run the custom seed script:
   ```bash
   npm run data:import
   ```
   *You should explicitly see `Data Imported!` printed in green text on your terminal.*
   *(If you ever need to wipe the database, you can run `npm run data:destroy`)*

---

## 5. Frontend Setup

The frontend (React Application) has its completely separate set of dependencies that need installing.

1. In your terminal, go back one level to the root directory, then navigate into the frontend folder:
   ```bash
   cd ..
   cd frontend
   ```
2. Install the React dependencies via npm:
   ```bash
   npm install
   ```
   *Wait for the installation to completely finish before proceeding.*

---

## 6. Running the Application

To ensure both the React frontend and the Express backend talk to each other correctly, they must both be actively running at the same time in separate terminal windows.

### Starting the Backend Server
1. Open a **new terminal window** or a new tab in your code editor.
2. Navigate to the backend folder:
   ```bash
   cd "path/to/E-Commerce Web Application/backend"
   ```
3. Start the node server:
   ```bash
   npm run dev
   ```
   *Terminal Output should say: `Server running in development mode on port 5000` and `MongoDB Connected: ...`*

### Starting the Frontend Server
1. Open a **second, separate terminal window** or tab.
2. Navigate to the frontend folder:
   ```bash
   cd "path/to/E-Commerce Web Application/frontend"
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   *Terminal Output should say: `VITE vX.X.X  ready in XXX ms` and provide a Local URL, typically `http://localhost:5173/`.*

### Accessing the App
1. Open your web browser (Chrome, Firefox, Safari).
2. Go to the frontend URL provided by Vite: `http://localhost:5173/`
3. You should now see the beautifully rendered Quad Tech homepage!

---

## 7. Troubleshooting Guide

* **Error: `proxy error: could not proxy request...`**
  * *Reason:* The frontend is trying to request data from the backend, but the backend isn't running.
  * *Fix:* Ensure you have `npm run dev` actively running in the `backend` folder terminal.
* **Error: `MongooseError: Operation "users.insertOne()" buffering timed out...`**
  * *Reason:* The backend cannot communicate with MongoDB.
  * *Fix:* Verify your `.env` file is literally named `.env` and contains the `MONGO_URI` correctly without any typos. Also, ensure your network/firewall allows access to MongoDB Atlas.
* **Error: `command not found: npm`**
  * *Reason:* Node.js was not installed successfully or requires a computer restart to register the environmental path.
  * *Fix:* Restart your terminal or computer, and verify node is installed.
