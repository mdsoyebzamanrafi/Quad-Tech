# PROJECT_ARCHITECTURE_AND_DATAFLOW

This guide explains how the current `D:\CSE470\project` codebase works, using the source files as ground truth.

---

## 1. Project purpose

From the code, this is a **MERN e-commerce application** for technology products (Quad Tech). It supports:

- Product browsing, category filtering, keyword search, and suggestion search
- Product detail view and cart management
- User auth with email/password + reCAPTCHA
- OTP-based email verification for signup
- Google login
- Forgot/reset password via OTP
- Order placement and order tracking (current vs delivered)

The runtime app is split into:

- `frontend/`: React SPA UI
- `backend/`: Express API + MongoDB persistence

---

## 2. Tech stack in this repo

### Frontend (`frontend/`)

- React 19 (`react`, `react-dom`)
- React Router (`react-router-dom`)
- Vite (`vite`, `@vitejs/plugin-react`)
- Axios (`frontend/src/utils/api.js`)
- Context API for state (`AuthContext`, `CartContext`, `ThemeContext`)
- Google OAuth client (`@react-oauth/google`)
- Google reCAPTCHA (`react-google-recaptcha`)
- Lucide icons (`lucide-react`)

### Backend (`backend/`)

- Node.js + Express 5
- MongoDB + Mongoose
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Google token verification (`google-auth-library`)
- Email sending (`nodemailer`)
- Env loading (`dotenv`)

### Deployment configs present

- Netlify frontend build/redirect config (`netlify.toml`)
- SPA fallback route (`frontend/public/_redirects`)

---

## 3. High-level architecture

### Browser layer

- Loads `frontend/index.html`
- Mounts React app into `<div id="root"></div>`

### React frontend layer

- Starts at `frontend/src/main.jsx`
- Wraps app with providers: theme, auth, cart
- Routes defined in `frontend/src/App.jsx`
- Calls backend using shared Axios instance (`frontend/src/utils/api.js`)

### API layer

- Frontend calls `/api/...` endpoints
- Dev-time proxy in `frontend/vite.config.js` forwards `/api` to `http://localhost:5000`
- Axios interceptor adds `Authorization: Bearer <token>` from `localStorage.userInfo`

### Express backend layer

- Starts from `backend/server.js`
- Connects DB (`backend/config/db.js`)
- Applies middleware (`cors`, `express.json`)
- Mounts route modules:
  - `/api/users`
  - `/api/products`
  - `/api/orders`
  - `/api/payment`

### Database layer

- Mongoose models:
  - `User`
  - `Product`
  - `Order`

### External services

- Google reCAPTCHA server verification (`userController.verifyRecaptcha`)
- Google OAuth token/userinfo verification (`userController.googleAuth`)
- SMTP email sending for OTP/reset (`utils/sendEmail.js`)

### End-to-end request shape

`UI action -> React page/context -> Axios -> Express route -> Controller -> Mongoose model -> MongoDB -> JSON response -> UI state update`

---

## 4. Repository structure

### Current root tree (important parts)

```text
D:\CSE470\project
+- backend
¦  +- config/db.js
¦  +- controllers/
¦  +- data/
¦  +- middleware/authMiddleware.js
¦  +- models/
¦  +- routes/
¦  +- utils/
¦  +- generateProducts.js
¦  +- seeder.js
¦  +- server.js
+- frontend
¦  +- public/_redirects
¦  +- src
¦  ¦  +- components/
¦  ¦  +- context/
¦  ¦  +- pages/
¦  ¦  +- styles/
¦  ¦  +- utils/api.js
¦  ¦  +- App.jsx
¦  ¦  +- main.jsx
¦  +- index.html
¦  +- vite.config.js
+- README.md
+- netlify.toml
```

### Why these folders exist

- `frontend/`: all browser/UI concerns
- `backend/`: all API/business/data concerns
- `backend/data`: seed datasets
- `backend/controllers` + `routes` + `models`: layered backend organization

---

## 5. Frontend architecture

### Startup flow

1. `frontend/index.html` loads `/src/main.jsx`
2. `frontend/src/main.jsx` mounts `<App />` and wraps providers:
   - `ThemeProvider`
   - `AuthProvider`
   - `CartProvider`
3. `frontend/src/App.jsx` wraps with:
   - `GoogleOAuthProvider`
   - `ThemeProvider` (second time)
   - `BrowserRouter`

Important note: `ThemeProvider` is currently nested twice (`main.jsx` and `App.jsx`).

### Routing flow (`frontend/src/App.jsx`)

- `/` -> `HomePage`
- `/product/:id` -> `ProductDetails`
- `/cart` -> `CartPage`
- `/login` -> `LoginPage`
- `/register` -> `RegisterPage`
- `/verify` -> `OTPVerificationPage`
- `/forgotpassword` -> `ForgotPasswordPage`
- `/resetpassword` -> `ResetPasswordPage`
- `/setpassword` -> `SetPasswordPage`
- `/shipping` -> `ShippingPage`
- `/payment` -> `PaymentPage`
- `/placeorder` -> `PlaceOrderPage`
- `/profile` -> `ProfilePage`
- `/orders` -> `OrdersPage`

### Page/component structure

- Shared layout:
  - `components/Layout.jsx` -> `Navbar` + route content + `Footer`
- Global behavior:
  - `components/ScrollToTop.jsx`
- Feature pages:
  - product pages (`HomePage`, `ProductDetails`)
  - cart/checkout pages (`CartPage`, `ShippingPage`, `PaymentPage`, `PlaceOrderPage`)
  - auth pages (`LoginPage`, `RegisterPage`, `OTPVerificationPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `SetPasswordPage`)
  - account pages (`ProfilePage`, `OrdersPage`)

### State management

- `AuthContext`:
  - holds `userInfo`
  - methods: `login`, `register`, `googleLogin`, `verifyOTP`, `logout`, `updateUserInfo`
- `CartContext`:
  - reducer-driven cart state
  - persists `cartItems`, `shippingAddress`, `paymentMethod` in localStorage
- `ThemeContext`:
  - toggles dark/light
  - applies `dark` class on document root

### API utilities

`frontend/src/utils/api.js`:

- `baseURL = VITE_API_URL || ''`
- request interceptor injects bearer token from localStorage
- response interceptor logs 401

### Form submission flow (common pattern)

- page state via `useState`
- `submitHandler` calls context or `api.post(...)`
- handles loading and error state
- navigates on success

### Protected UI logic (frontend)

- No single global `PrivateRoute` wrapper.
- Per-page guards:
  - `ProfilePage`, `OrdersPage`: redirect to `/login` if no `userInfo`
  - `PaymentPage`: redirect to `/shipping` if no address
  - `PlaceOrderPage`: redirect if checkout data missing
- Extra forced-flow guard:
  - in `App.jsx`, users with `needsPassword` are redirected to `/setpassword`

---
## 6. Backend architecture

### Server startup

Startup path:

- command: `npm run dev` or `npm start` in `backend/`
- entrypoint: `backend/server.js`

`server.js` flow:

1. `dotenv.config()`
2. `connectDB()` (from `config/db.js`)
3. create Express app
4. `app.use(cors())`
5. `app.use(express.json())`
6. mount routes (`/api/users`, `/api/products`, `/api/orders`, `/api/payment`)
7. `app.listen(PORT)`

### Express configuration

- Uses JSON parsing and CORS globally.
- No centralized error middleware; errors are handled inside controllers.

### Middleware chain

- Global: `cors`, `express.json`
- Route-level:
  - `protect`: JWT auth, loads `req.user`
  - `admin`: checks `req.user.isAdmin`

### Route registration and responsibilities

- `routes/userRoutes.js`
  - register/login/verify/google auth/forgot/reset/set password/profile
- `routes/productRoutes.js`
  - list/detail/suggestions/reviews/create product
- `routes/orderRoutes.js`
  - create order, get my orders, get order by id, mark delivered
- `routes/paymentRoutes.js`
  - simulated payment process + public key config

### Controller responsibilities

- `userController.js`: auth + verification + password recovery + Google auth
- `productController.js`: product queries + suggestions + reviews + admin create
- `orderController.js`: order creation + stock decrement + user order retrieval + delivery mark
- `paymentController.js`: scaffolded payment responses

### Model responsibilities

- `models/User.js`: user identity and auth-related fields
- `models/Product.js`: catalog item and reviews
- `models/Order.js`: checkout snapshot and order status

### DB connection flow

`backend/config/db.js` connects with:

- `mongoose.connect(process.env.MONGO_URI)`
- on failure logs and `process.exit(1)`

---

## 7. Important files explained one by one

Each entry includes: path, role, imported by, depends on, data in/out, runtime fit.

### `frontend/index.html`

- Role: browser entry document
- Imported by: browser
- Depends on: `/src/main.jsx`
- Data in/out: none
- Runtime fit: mount root for React app

### `frontend/src/main.jsx`

- Role: frontend bootstrap
- Imported by: `index.html`
- Depends on: `App.jsx`, providers
- Data in/out: none directly
- Runtime fit: assembles top-level provider tree

### `frontend/src/App.jsx`

- Role: route map and high-level app shell behavior
- Imported by: `main.jsx`
- Depends on: pages/components, auth context, Google provider, router
- Data in/out: reads `userInfo` to enforce `needsPassword` redirect
- Runtime fit: central client-side route controller

### `frontend/src/utils/api.js`

- Role: shared HTTP client
- Imported by: contexts and pages
- Depends on: Axios, `VITE_API_URL`, localStorage
- Data in/out:
  - Sends all REST API requests
  - Adds `Authorization` header when token exists
- Runtime fit: API transport abstraction for frontend

### `frontend/src/context/AuthContext.jsx`

- Role: auth state + auth actions
- Imported by: `main.jsx`, pages/components via `useAuth`
- Depends on: `api.js`
- Data in/out:
  - Inputs: login/register/OAuth/reset forms
  - Outputs: `userInfo` object in state/localStorage
- Runtime fit: frontend auth orchestration

### `frontend/src/context/CartContext.jsx`

- Role: cart reducer + persistence
- Imported by: `main.jsx`, cart/checkout/nav/product pages
- Depends on: `api.js`, localStorage
- Data in/out:
  - Gets product by id before adding to cart
  - Stores cart/shipping/payment data
- Runtime fit: commerce state manager

### `frontend/src/pages/HomePage.jsx`

- Role: primary catalog page
- Imported by: `App.jsx`
- Depends on: `api.js`, router query params
- Data in/out:
  - Calls `GET /api/products?limit=200`
  - Receives `{ products, page, pages }`
- Runtime fit: product listing/filtering and deep-link display

### `frontend/src/components/Navbar.jsx`

- Role: navigation, search, suggestions, auth/cart controls
- Imported by: `Layout.jsx`
- Depends on: auth/cart/theme contexts, `api.js`, router
- Data in/out:
  - Calls `GET /api/products/search/suggestions?q=...`
  - Updates URL search params via navigation
- Runtime fit: global interaction hub

### `frontend/src/pages/ProductDetails.jsx`

- Role: single product screen
- Imported by: `App.jsx`
- Depends on: `api.js`, `useCart`
- Data in/out:
  - Calls `GET /api/products/:id`
  - Sends selected qty into cart context
- Runtime fit: product to cart conversion point

### `frontend/src/pages/CartPage.jsx`

- Role: cart view and current active checkout trigger
- Imported by: `App.jsx`
- Depends on: cart/auth contexts, `api.js`
- Data in/out:
  - Calls `POST /api/orders`
  - Sends order snapshot and receives created order
- Runtime fit: immediate order creation path

### `backend/server.js`

- Role: backend composition root
- Imported by: Node runtime from package scripts
- Depends on: DB config + route modules
- Data in/out: receives all API traffic and delegates to routes
- Runtime fit: API app bootstrap

### `backend/routes/userRoutes.js`

- Role: user/auth endpoint map
- Imported by: `server.js`
- Depends on: `userController`, `protect`
- Data in/out: forwards request/response to controller functions
- Runtime fit: URL-to-handler mapping for identity flows

### `backend/controllers/userController.js`

- Role: auth and account business logic
- Imported by: `userRoutes.js`
- Depends on: `User`, JWT helper, email utility, Google auth library
- Data in/out:
  - Input: credentials, tokens, OTPs
  - Output: user session payloads + status messages
- Runtime fit: core identity engine

### `backend/middleware/authMiddleware.js`

- Role: JWT authorization gate
- Imported by: user/product/order/payment routes
- Depends on: `jsonwebtoken`, `User`
- Data in/out:
  - Reads bearer token
  - Writes authenticated user to `req.user`
- Runtime fit: gatekeeper for protected APIs

### `backend/controllers/productController.js`

- Role: product retrieval and mutation logic
- Imported by: `productRoutes.js`
- Depends on: `Product`
- Data in/out:
  - returns list/detail/suggestions
  - accepts review/admin create payloads
- Runtime fit: catalog business logic

### `backend/controllers/orderController.js`

- Role: order lifecycle operations
- Imported by: `orderRoutes.js`
- Depends on: `Order`, `Product`
- Data in/out:
  - Input: cart + shipping + pricing data
  - Output: persisted order docs
  - Side effect: decrements product stock
- Runtime fit: checkout persistence and order state handling

### `backend/models/User.js`

- Role: user data model + password logic
- Imported by: middleware/controllers/seeder
- Depends on: Mongoose, bcrypt
- Data in/out:
  - hashes password in `pre('save')`
  - compares password via `matchPassword`
- Runtime fit: account persistence and password security

### `backend/models/Product.js`

- Role: product model (with embedded reviews)
- Imported by: product/order controllers, seeder
- Depends on: Mongoose
- Data in/out: product docs and review subdocs
- Runtime fit: catalog persistence

### `backend/models/Order.js`

- Role: order model
- Imported by: order controller, seeder
- Depends on: Mongoose
- Data in/out: order snapshots (items, totals, status)
- Runtime fit: purchase record persistence

### `backend/config/db.js`

- Role: DB connector
- Imported by: `server.js`, `seeder.js`
- Depends on: Mongoose, `MONGO_URI`
- Data in/out: DB connection state only
- Runtime fit: infrastructure initialization

---

## 8. Data flow scenarios

### Scenario A: Browse products on home page

- User action: open `/`
- Frontend file(s): `App.jsx` -> `HomePage.jsx`
- API request: `GET /api/products?limit=200`
- Backend route file: `routes/productRoutes.js`
- Controller file: `controllers/productController.js` (`getProducts`)
- Model file: `models/Product.js`
- Database operation: count + paged find query
- Response: `{ products, page, pages }`
- UI update: product list is sorted/filter-ready and rendered as cards

### Scenario B: Search suggestion dropdown in navbar

- User action: type in search box
- Frontend file(s): `components/Navbar.jsx`
- API request: `GET /api/products/search/suggestions?q=<term>`
- Backend route file: `routes/productRoutes.js`
- Controller file: `controllers/productController.js` (`getProductSuggestions`)
- Model file: `models/Product.js`
- Database operation: regex query on `name/category`
- Response: array of suggestion strings
- UI update: dropdown renders; click navigates to `/?keyword=...`

### Scenario C: Email registration + OTP verify

- User action: submit register form
- Frontend file(s): `RegisterPage.jsx` -> `AuthContext.register`
- API request: `POST /api/users`
- Backend route file: `routes/userRoutes.js`
- Controller file: `controllers/userController.js` (`registerUser`)
- Model file: `models/User.js`
- Database operation:
  - find by email
  - create or update unverified user
  - save OTP code and expiry
- External operation: send OTP email via `utils/sendEmail.js`
- Response: `{ status: 'pending_verification', email }`
- UI update: navigate to `/verify`

Then OTP confirmation:

- User action: enter 6-digit OTP and submit
- Frontend file(s): `OTPVerificationPage.jsx` -> `AuthContext.verifyOTP`
- API request: `POST /api/users/verify`
- Backend route/controller/model: `userRoutes` -> `verifyOTP` -> `User.findOne/save`
- Database operation: validate OTP + expiry, mark `isVerified=true`
- Response: user session payload + JWT
- UI update: `userInfo` saved to localStorage; navigate `/`
### Scenario D: Google login + password attachment

- User action: click Google login on login/register page
- Frontend file(s): `LoginPage.jsx` or `RegisterPage.jsx` -> `AuthContext.googleLogin`
- API request: `POST /api/users/google`
- Backend route file: `routes/userRoutes.js`
- Controller file: `controllers/userController.js` (`googleAuth`)
- External service:
  - verifies Google ID token, or
  - fetches user profile from Google userinfo endpoint with access token
- Model file: `models/User.js`
- Database operation: find/create user by email
- Response: session payload with `needsPassword` flag
- UI update: if `needsPassword=true`, redirect to `/setpassword`

Set-password follow-up:

- Frontend file: `SetPasswordPage.jsx`
- API request: `POST /api/users/setpassword` (protected)
- Backend chain: `protect` middleware -> `userController.setGooglePassword`
- DB operation: save hashed password
- UI update: userInfo updated (`needsPassword=false`)

### Scenario E: Place order from cart modal (current main flow)

- User action: cart -> proceed -> confirm payment modal
- Frontend file(s): `CartPage.jsx`
- API request: `POST /api/orders`
- Backend route file: `routes/orderRoutes.js`
- Middleware: `protect` (auth required)
- Controller file: `controllers/orderController.js` (`addOrderItems`)
- Model files: `Order.js`, `Product.js`
- Database operation:
  - create order with totals and shipping
  - mark order as paid (`isPaid=true`)
  - decrement stock for each product
- Response: created order
- UI update: cart cleared, navigate `/orders`

### Scenario F: View and mark orders as received

- User action: open orders page, click "Received"
- Frontend file(s): `OrdersPage.jsx`
- API request:
  - `GET /api/orders/myorders`
  - `PUT /api/orders/:id/deliver`
- Backend route file: `routes/orderRoutes.js`
- Controller file: `controllers/orderController.js`
- Model file: `Order.js`
- Database operation:
  - get all orders for logged-in user
  - set `isDelivered=true`, `deliveredAt=Date.now()`
- Response: updated order + refreshed list
- UI update: order moves from current orders to past orders view

### Scenario G: Forgot password + reset password

- User action: forgot password form submit
- Frontend file: `ForgotPasswordPage.jsx`
- API request: `POST /api/users/forgotpassword`
- Backend chain: `userRoutes` -> `userController.forgotPassword`
- Model operation: save reset OTP + expiry
- External operation: send reset email
- Response: `{ message: 'Email sent' }`
- UI update: navigate to `/resetpassword`

Then reset submit:

- Frontend file: `ResetPasswordPage.jsx`
- API request: `POST /api/users/resetpassword`
- Backend chain: `userController.resetPassword`
- Model operation: find by email+OTP+expiry, save new hashed password
- Response: success message
- UI update: redirect to `/login`

---

## 9. Authentication and authorization

### Signup/login paths

- Email/password login: `POST /api/users/login`
- Email register: `POST /api/users` + OTP verify `POST /api/users/verify`
- Google auth: `POST /api/users/google`
- Password recovery: `POST /api/users/forgotpassword`, `POST /api/users/resetpassword`

### JWT/token handling

- JWT generated by `backend/utils/generateToken.js`
- Returned in JSON response payload
- Stored in `localStorage.userInfo`
- Attached by Axios request interceptor as `Authorization: Bearer <token>`
- Verified in `backend/middleware/authMiddleware.js`

### Auth middleware

- `protect`:
  - parses bearer token
  - verifies signature with `JWT_SECRET`
  - loads `req.user`
- `admin`:
  - allows only users with `isAdmin=true`

### Protected backend endpoints in this repo

- `GET /api/users/profile`
- `POST /api/users/setpassword`
- `POST /api/orders`
- `GET /api/orders/myorders`
- `GET /api/orders/:id`
- `PUT /api/orders/:id/deliver`
- `POST /api/payment/process`
- `GET /api/payment/config`
- `POST /api/products` (also admin-only)
- `POST /api/products/:id/reviews`

### Frontend protected pages/flows

- `ProfilePage` and `OrdersPage` redirect unauthenticated users to `/login`
- Checkout actions in `CartPage` require login before placing order
- `App.jsx` enforces `/setpassword` for users with `needsPassword`

### Role checks

- Admin check exists only on `POST /api/products`
- No admin UI page currently in frontend routes

### OTP, Google, reCAPTCHA

- Signup + password reset use OTP email flows
- Login/register/forgot password enforce reCAPTCHA token verification backend-side
- Google login supports both ID token and access token styles

---

## 10. Model and database relationships

### User model (`backend/models/User.js`)

Represents account identity and auth state.

Main fields:

- `name`, `email`, `password`, `isAdmin`
- `isVerified`, `otpCode`, `otpExpire`
- `resetPasswordToken`, `resetPasswordExpire`

Used by:

- `userController` (register/login/verify/google/reset flows)
- `authMiddleware` (token -> user lookup)

### Product model (`backend/models/Product.js`)

Represents catalog items.

Main fields:

- `name`, `brand`, `category`, `description`, `image`
- `price`, `countInStock`, `rating`, `numReviews`
- `reviews[]` subdocuments with `user` ref

Used by:

- `productController` (list/detail/suggestions/reviews)
- `orderController` (stock decrement during order create)

### Order model (`backend/models/Order.js`)

Represents checkout snapshot and order status.

Main fields:

- `user` ref
- `orderItems[]` (with `product` ref)
- `shippingAddress`
- `paymentMethod`, `paymentResult`
- `taxPrice`, `shippingPrice`, `totalPrice`
- `isPaid`, `paidAt`, `isDelivered`, `deliveredAt`

Used by:

- `orderController`

### Relationship summary

- One user can have many orders.
- One order contains many order items.
- Each order item references a product.
- Each product can have many reviews by users.

---

## 11. Environment/config flow

### Backend config inputs

From code usage, backend expects these env keys:

- `PORT`
- `NODE_ENV`
- `MONGO_URI`
- `JWT_SECRET`
- `RECAPTCHA_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
- `STRIPE_PUBLIC_KEY`, `PAYPAL_CLIENT_ID`

Flow examples:

- `MONGO_URI` -> DB connection in `config/db.js`
- `JWT_SECRET` -> token sign/verify (`generateToken.js`, `authMiddleware.js`)
- `RECAPTCHA_SECRET_KEY` -> `verifyRecaptcha` in `userController.js`
- SMTP keys -> email transport in `sendEmail.js`
- payment public keys -> `paymentController.getPaymentConfig`

### Frontend config inputs

Expected keys:

- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_RECAPTCHA_SITE_KEY`

Flow examples:

- `VITE_API_URL` -> Axios base URL in `utils/api.js`
- Google/ReCAPTCHA keys -> login/register/forgot pages and app provider

### Current repo state note

- `backend/.env` and `frontend/.env` are **not present** in this working tree.
- Project setup therefore depends on creating those files manually.

---

## 12. Error flow

### Backend

- Controllers use local `try/catch` and return JSON `{ message: ... }`.
- There is no centralized error handler middleware.

Common statuses observed:

- `400`: validation/business rule issues (e.g., bad OTP, captcha fail)
- `401`: token or authorization failure
- `404`: missing user/product/order
- `500`: server/runtime errors

Important behavior issue:

- In `orderController.markOrderAsReceived`, code sets `res.status(401)` or `res.status(404)` and then throws, but catch always returns `res.status(500)`. So intended status can be overridden to 500.

### Frontend

- Error handling is page-local via state (`errorMsg`) and occasional `alert(...)`.
- No global toast/error boundary pattern.
- Axios response interceptor logs 401 but does not auto-logout.

---
## Dependency map (runtime critical paths)

### Frontend dependency spine

- `frontend/index.html` -> `frontend/src/main.jsx`
- `main.jsx` -> providers (`ThemeContext`, `AuthContext`, `CartContext`) -> `App.jsx`
- `App.jsx` -> `Layout` + page components
- page/components -> `utils/api.js` + contexts
- `utils/api.js` -> backend `/api/*` endpoints

### Backend dependency spine

- `backend/server.js` -> `config/db.js`
- `server.js` -> route modules
- route modules -> middleware (`protect/admin`) + controllers
- controllers -> models + utils (token/email)
- models -> MongoDB collections via Mongoose

---

## 13. Local setup guide

### Prerequisites

- Node.js (16+ recommended, 20+ better)
- npm
- MongoDB instance (Atlas or local)

### Backend setup

```powershell
cd backend
npm install
```

Create `backend/.env` (minimum values):

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
GOOGLE_CLIENT_ID=your_google_client_id
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM_NAME=Quad Tech
SMTP_FROM_EMAIL=your_from_email
STRIPE_PUBLIC_KEY=optional
PAYPAL_CLIENT_ID=optional
```

Run backend:

```powershell
npm run dev
```

### Frontend setup

```powershell
cd ..\frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Run frontend:

```powershell
npm run dev
```

### Optional: seed data

From `backend/`:

```powershell
npm run data:import
```

### Startup path summary

- Frontend: `frontend/index.html` -> `frontend/src/main.jsx` -> `frontend/src/App.jsx`
- Backend: `backend/package.json` scripts -> `backend/server.js`

---

## 14. Common confusion points for MERN beginners in this specific repo

1. **Two checkout implementations exist**
- `CartPage` directly posts orders via modal confirmation.
- `ShippingPage`/`PaymentPage`/`PlaceOrderPage` is another flow, but not primary from the cart CTA.

2. **Payment routes are scaffolded but not integrated into frontend flow**
- `/api/payment/process` and `/api/payment/config` are not called by current React pages.

3. **Theme provider is wrapped twice**
- In both `main.jsx` and `App.jsx`.

4. **No centralized frontend route guard**
- Auth checks are spread across individual pages.

5. **Profile update UI is simulated**
- `ProfilePage` has commented future API update line; no real profile update request exists.

6. **Seed user password handling is suspicious**
- `backend/data/users.js` imports bcrypt but stores plain text passwords.
- With `insertMany`, beginners may incorrectly assume pre-save hashing always occurs.

7. **README env keys are partially outdated vs actual code**
- Root README uses `EMAIL_USER` / `EMAIL_PASS`, but code uses `SMTP_USER` / `SMTP_PASS`.

8. **Footer links include routes not present in router**
- `/products` and `/about` links exist, but no matching route elements in `App.jsx`.

9. **Authorization status bug in order delivery handler**
- Intended 401/404 can be returned as 500 due to catch block logic.

10. **`crypto` imported in `userController.js` but not used**
- This is dead import code.

11. **Extra nested folder exists at repo root (`Quad-Tech/`)**
- Current active app runs from root `backend/` and `frontend/`; duplicate folder can confuse onboarding.

---

## 15. Final architecture summary

This codebase is a standard layered MERN app with a clear request chain:

1. React UI (`frontend/src/pages/*`) captures user actions.
2. Shared Axios client (`frontend/src/utils/api.js`) sends requests and attaches JWT token.
3. Express routes (`backend/routes/*`) map endpoint to controller.
4. Controllers (`backend/controllers/*`) apply business logic and call models.
5. Mongoose models (`backend/models/*`) persist and query MongoDB.
6. JSON response returns to React, where page/context state updates the UI.

The most important thing for new contributors is to trace features in this order:

- start from page/component in `frontend/src/pages`
- follow API call in `frontend/src/utils/api.js`
- locate endpoint in `backend/routes`
- read controller logic in `backend/controllers`
- verify schema/data shape in `backend/models`

If you follow that path, every major user journey in this project becomes understandable and debuggable quickly.
