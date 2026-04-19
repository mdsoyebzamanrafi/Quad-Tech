git remote -v
# PROJECT_ARCHITECTURE_AND_DATAFLOW

This document explains how the **Quad Tech** MERN project works by reading the actual code under:

- `backend/`
- `frontend/`

The goal is to help a beginner understand how requests move through the app, how data is stored, and which files matter most.

---

# 1. Project purpose

From the code, this project is an **e-commerce web app** for tech products.

What users can do:
- Browse product catalog (`HomePage`, `ProductDetails`)
- Search products and get autocomplete suggestions (`Navbar` + `/api/products/search/suggestions`)
- Add/remove items in cart (`CartContext`, `CartPage`)
- Register/login with email + password (with reCAPTCHA)
- Verify account via OTP email
- Login with Google OAuth
- Set a password later for Google-created accounts
- Request password reset via OTP email
- Place orders
- View current and past orders
- Mark an order as received

Important observation:
- The checkout flow currently has **two styles**:
  - A full shipping/payment/place-order path (`ShippingPage`, `PaymentPage`, `PlaceOrderPage`)
  - A direct cart modal payment confirmation path (`CartPage`) that is currently the main used one.

---

# 2. Tech stack in this repo

## Frontend
- **React 19** (`frontend/src`)
- **Vite** dev/build tooling (`frontend/package.json`, `frontend/vite.config.js`)
- **React Router DOM** for client routing (`frontend/src/App.jsx`)
- **Axios** for API requests (`frontend/src/utils/api.js`)
- **Context API** for global state:
  - Auth: `frontend/src/context/AuthContext.jsx`
  - Cart: `frontend/src/context/CartContext.jsx`
  - Theme: `frontend/src/context/ThemeContext.jsx`
- **Google OAuth client** (`@react-oauth/google`)
- **Google reCAPTCHA** (`react-google-recaptcha`)
- **Lucide icons**

## Backend
- **Node.js + Express 5** (`backend/server.js`)
- **MongoDB + Mongoose** (`backend/config/db.js`, `backend/models/*`)
- **JWT authentication** (`backend/utils/generateToken.js`, `backend/middleware/authMiddleware.js`)
- **bcryptjs** for password hashing (`backend/models/User.js`)
- **Nodemailer** for OTP/reset emails (`backend/utils/sendEmail.js`)
- **Google Auth Library** for backend Google token verification (`backend/controllers/userController.js`)

## Deployment-related
- Netlify frontend config (`netlify.toml`, `frontend/public/_redirects`)

---

# 3. High-level architecture

Think of the app in layers:

1. **Browser**
   - Loads `frontend/index.html`
   - Runs React app from `src/main.jsx`

2. **React frontend**
   - Handles pages/routes in `src/App.jsx`
   - Manages user/cart/theme state via contexts
   - Calls backend REST API via Axios (`src/utils/api.js`)

3. **API layer (HTTP calls)**
   - Frontend sends requests to `/api/...`
   - Axios adds JWT `Authorization: Bearer <token>` automatically if `userInfo` is in localStorage

4. **Express backend**
   - Starts in `backend/server.js`
   - Applies middleware (`cors`, `express.json`)
   - Mounts route modules:
     - `/api/users`
     - `/api/products`
     - `/api/orders`
     - `/api/payment`

5. **MongoDB**
   - Connected through `backend/config/db.js`
   - Data models:
     - `User`
     - `Product`
     - `Order`

6. **External services**
   - Google reCAPTCHA verification (server-side)
   - Google OAuth token/userinfo validation
   - SMTP mail server for OTP emails

Simple runtime picture:

`Browser UI -> React page/component -> Axios -> Express route -> Controller -> Mongoose model -> MongoDB -> Response -> React state/UI update`

---
# 4. Repository structure

Top-level relevant structure:

```text
Quad-Tech/
  backend/
    config/
      db.js
    controllers/
      userController.js
      productController.js
      orderController.js
      paymentController.js
    data/
      products.js
      users.js
    middleware/
      authMiddleware.js
    models/
      User.js
      Product.js
      Order.js
    routes/
      userRoutes.js
      productRoutes.js
      orderRoutes.js
      paymentRoutes.js
    utils/
      generateToken.js
      sendEmail.js
    server.js
    seeder.js
    generateProducts.js
    .env
  frontend/
    public/
      _redirects
    src/
      components/
      context/
      pages/
      styles/
      utils/
      App.jsx
      main.jsx
      index.css
    index.html
    vite.config.js
    .env
  netlify.toml
  README.md
```

Why this split exists:
- `frontend/` is the browser app.
- `backend/` is the API + DB logic.
- `data/` + `seeder.js` support initial sample data loading.

---

# 5. Frontend architecture

## Startup flow

1. `frontend/index.html` defines `<div id="root"></div>` and loads `src/main.jsx`.
2. `src/main.jsx` creates React root and wraps `<App />` with:
   - `ThemeProvider`
   - `AuthProvider`
   - `CartProvider`
3. `src/App.jsx` sets:
   - `GoogleOAuthProvider`
   - `BrowserRouter`
   - `Layout` + route definitions.

Important note:
- `ThemeProvider` is used in both `main.jsx` and `App.jsx` (duplicate nesting). This is redundant and can confuse beginners.

## Routing flow

Routes are declared in `src/App.jsx`:
- `/` -> `HomePage`
- `/product/:id` -> `ProductDetails`
- `/cart` -> `CartPage`
- `/login`, `/register`
- `/verify` (OTP verification)
- `/forgotpassword`, `/resetpassword`
- `/setpassword` (for Google-auth users lacking local password)
- `/shipping`, `/payment`, `/placeorder`
- `/profile`, `/orders`

There is no catch-all `*` route for 404 page.

## Page/component structure

- Shared shell:
  - `components/Layout.jsx` -> `Navbar` + page content + `Footer`
- Navigation/UI:
  - `components/Navbar.jsx` includes search, theme toggle, user menu, cart badge
  - `components/Footer.jsx` static links/info
  - `components/ScrollToTop.jsx` scroll behavior on route/search changes
- Feature pages in `pages/` (home, product details, auth, cart, checkout, profile/orders)

## State management

### Auth state (`AuthContext`)
- Source of truth: `userInfo` state + `localStorage.userInfo`
- Exposes:
  - `login`
  - `register`
  - `verifyOTP`
  - `googleLogin`
  - `logout`
  - `updateUserInfo`

### Cart state (`CartContext`)
- Uses `useReducer`
- Persists to localStorage:
  - `cartItems`
  - `shippingAddress`
  - `paymentMethod`
- Exposes:
  - `addToCart`, `removeFromCart`, `clearCart`
  - `saveShippingAddress`, `savePaymentMethod`

### Theme state (`ThemeContext`)
- Tracks dark/light mode
- Applies/removes `.dark` class on `<html>`

## API utilities

`src/utils/api.js`:
- Axios instance
- `baseURL` from `VITE_API_URL` (or empty string fallback)
- Request interceptor attaches JWT from localStorage
- Response interceptor logs 401s

Backend call paths used in frontend (examples):
- `/api/users/login`
- `/api/users` (register)
- `/api/users/verify`
- `/api/users/google`
- `/api/users/forgotpassword`
- `/api/users/resetpassword`
- `/api/users/setpassword`
- `/api/products`
- `/api/products/:id`
- `/api/products/search/suggestions`
- `/api/orders`
- `/api/orders/myorders`
- `/api/orders/:id/deliver`

## Form submission flow

Typical pattern:
1. Local `useState` stores form fields.
2. `submitHandler` prevents default form submit.
3. Calls context method or `api.post(...)`.
4. Handles:
   - loading state
   - errors in local state
   - navigation on success.

## Protected UI logic

There is no global route guard component for all private routes.

Protection currently happens per page:
- `ProfilePage`, `OrdersPage` redirect to `/login` if `!userInfo`
- `CartPage` checkout redirects to `/login?redirect=cart` if needed
- `PaymentPage` redirects to `/shipping` if address missing
- `PlaceOrderPage` redirects if shipping/payment data missing

Extra auth rule:
- `App.jsx` `RequirePassword` redirects logged-in users with `needsPassword` to `/setpassword`.

---
# 6. Backend architecture

## Server startup

`backend/server.js`:
1. Loads env with `dotenv.config()`
2. Creates Express app
3. Applies middleware:
   - `cors()`
   - `express.json()`
4. Registers basic routes:
   - `GET /` (health text)
   - `GET /api/health` (service + DB state)
5. Mounts route modules:
   - `/api/users`
   - `/api/products`
   - `/api/orders`
   - `/api/payment`
6. Calls `connectDB()` before `app.listen(...)`

## Express configuration

No centralized error middleware is present.
Controllers use per-handler `try/catch` blocks and return JSON messages.

## Middleware chain

Main global middleware:
- `cors`
- JSON body parsing

Auth middleware:
- `protect` parses `Authorization: Bearer <token>`
- verifies JWT
- loads user document into `req.user`

Optional admin middleware:
- `admin` checks `req.user.isAdmin`

## Route registration

### User routes (`routes/userRoutes.js`)
- `POST /api/users` -> register
- `POST /api/users/verify` -> verify email OTP
- `POST /api/users/login` -> login
- `POST /api/users/google` -> Google auth
- `POST /api/users/forgotpassword` -> reset OTP email
- `POST /api/users/resetpassword` -> reset password
- `POST /api/users/setpassword` -> set password for Google account (protected)
- `GET /api/users/profile` -> profile (protected)

### Product routes (`routes/productRoutes.js`)
- `GET /api/products`
- `POST /api/products` (protected + admin)
- `GET /api/products/search/suggestions`
- `GET /api/products/:id`
- `POST /api/products/:id/reviews` (protected)

### Order routes (`routes/orderRoutes.js`)
- `POST /api/orders` (protected)
- `GET /api/orders/myorders` (protected)
- `GET /api/orders/:id` (protected)
- `PUT /api/orders/:id/deliver` (protected)

### Payment routes (`routes/paymentRoutes.js`)
- `POST /api/payment/process` (protected, simulated)
- `GET /api/payment/config` (protected)

## Controller responsibilities

- `userController.js`: auth, register/OTP verify, Google auth, forgot/reset password, set password
- `productController.js`: product list/details, suggestions, reviews, admin create
- `orderController.js`: create order, get user orders, mark received
- `paymentController.js`: payment simulation and config keys

## Model responsibilities

- `User`: identity, password hash, admin flag, verification/reset OTP fields
- `Product`: catalog item + embedded reviews
- `Order`: order snapshot (items, shipping, totals, paid/delivered status)

## DB connection flow

`config/db.js`:
- Reads `MONGO_URI`
- Connects with `mongoose.connect(...)`
- Exposes connection status helper `isDatabaseConnected()`
- Supports startup without DB if `ALLOW_START_WITHOUT_DB=true`

---

# 7. Important files explained one by one

Below are key runtime files with their role and dependencies.

## Frontend core

### `frontend/index.html`
- Role: browser entry HTML.
- Imported by: browser directly.
- Depends on: `/src/main.jsx`.
- Data sends/receives: none.
- Runtime fit: bootstraps React mount point.

### `frontend/src/main.jsx`
- Role: React bootstrap and provider composition.
- Imported by: `index.html`.
- Depends on: `App.jsx`, theme/auth/cart contexts.
- Data sends/receives: none directly.
- Runtime fit: creates global app state wrappers.

### `frontend/src/App.jsx`
- Role: top-level routing and Google provider.
- Imported by: `main.jsx`.
- Depends on: all page components, `Layout`, auth hook, router APIs.
- Data sends/receives: reads `userInfo` for password-required redirect.
- Runtime fit: route controller for the entire frontend.

### `frontend/src/utils/api.js`
- Role: centralized Axios client.
- Imported by: contexts + many pages/components.
- Depends on: `axios`, `import.meta.env.VITE_API_URL`, localStorage `userInfo`.
- Data sends/receives: sends HTTP requests; injects auth header.
- Runtime fit: single API transport abstraction.

### `frontend/src/context/AuthContext.jsx`
- Role: auth state and auth actions.
- Imported by: `main.jsx` (provider), many pages/components via `useAuth`.
- Depends on: `api.js`, localStorage.
- Data sends/receives:
  - Sends login/register/google/verify/reset requests
  - Receives user payload + token
- Runtime fit: authentication orchestration layer for frontend.

### `frontend/src/context/CartContext.jsx`
- Role: cart reducer + persistence.
- Imported by: `main.jsx` (provider), cart/product/checkout/nav pages.
- Depends on: `api.js`, localStorage.
- Data sends/receives:
  - Fetches product details before add-to-cart
  - Stores cart/shipping/payment locally
- Runtime fit: shopping cart state layer.

### `frontend/src/components/Navbar.jsx`
- Role: global nav + live search suggestions + auth/cart UI.
- Imported by: `Layout.jsx`.
- Depends on: auth/cart/theme contexts, `api.js`, router.
- Data sends/receives:
  - Sends `/api/products/search/suggestions?q=...`
  - Receives suggestion list
- Runtime fit: top navigation + quick search gateway.

### `frontend/src/pages/HomePage.jsx`
- Role: product listing + category/keyword filtering.
- Imported by: `App.jsx`.
- Depends on: `api.js`, router location.
- Data sends/receives:
  - Sends `GET /api/products?limit=200`
  - Receives products list (object with `products`)
- Runtime fit: catalog landing page.

### `frontend/src/pages/ProductDetails.jsx`
- Role: single product detail view and add-to-cart.
- Imported by: `App.jsx`.
- Depends on: `api.js`, `useCart`.
- Data sends/receives:
  - Sends `GET /api/products/:id`
  - Receives product document
- Runtime fit: detailed item display and quantity selection.

### `frontend/src/pages/CartPage.jsx`
- Role: cart review and current �primary� checkout path.
- Imported by: `App.jsx`.
- Depends on: cart/auth contexts, `api.js`.
- Data sends/receives:
  - Sends `POST /api/orders` on confirm
  - Receives created order
- Runtime fit: immediate order placement from cart modal.
### `frontend/src/pages/LoginPage.jsx` and `RegisterPage.jsx`
- Role: credential auth and Google sign-in/up.
- Imported by: `App.jsx`.
- Depends on: `AuthContext`, reCAPTCHA component, Google login hook.
- Data sends/receives:
  - login/register/google endpoints
- Runtime fit: user onboarding/auth entry.

### `frontend/src/pages/OTPVerificationPage.jsx`
- Role: verify signup OTP.
- Imported by: `App.jsx`.
- Depends on: `AuthContext.verifyOTP`, router `location.state.email`.
- Data sends/receives: `/api/users/verify`.
- Runtime fit: completes email signup.

### `frontend/src/pages/ForgotPasswordPage.jsx` and `ResetPasswordPage.jsx`
- Role: password reset via OTP email flow.
- Imported by: `App.jsx`.
- Depends on: `api.js`, reCAPTCHA.
- Data sends/receives:
  - `/api/users/forgotpassword`
  - `/api/users/resetpassword`
- Runtime fit: account recovery.

### `frontend/src/pages/SetPasswordPage.jsx`
- Role: add local password for Google-created account.
- Imported by: `App.jsx`.
- Depends on: auth context + `/api/users/setpassword`.
- Data sends/receives: protected password-set request.
- Runtime fit: bridges OAuth-only accounts to email/password login.

### `frontend/src/pages/OrdersPage.jsx` and `ProfilePage.jsx`
- Role: order history/current orders and profile UI.
- Imported by: `App.jsx`.
- Depends on: auth context + orders API.
- Data sends/receives:
  - `GET /api/orders/myorders`
  - `PUT /api/orders/:id/deliver`
- Runtime fit: post-purchase account area.

## Backend core

### `backend/server.js`
- Role: backend entrypoint.
- Imported by: Node process (`npm start`/`npm run dev`).
- Depends on: DB connector, route modules, Express middleware.
- Data sends/receives: all API traffic starts here.
- Runtime fit: application composition root.

### `backend/config/db.js`
- Role: Mongo connection and status helper.
- Imported by: `server.js`, `seeder.js`.
- Depends on: `mongoose`, env vars.
- Data sends/receives: DB connection state.
- Runtime fit: infrastructure bootstrap.

### `backend/middleware/authMiddleware.js`
- Role: protect/admin guards.
- Imported by: route modules.
- Depends on: `jsonwebtoken`, `User` model.
- Data sends/receives:
  - Reads bearer token
  - Loads `req.user`
- Runtime fit: authentication gate for protected endpoints.

### `backend/routes/*.js`
- Role: map URL paths to controllers.
- Imported by: `server.js`.
- Depends on: controller functions and middleware.
- Data sends/receives: passes request into business logic.
- Runtime fit: API surface definition.

### `backend/controllers/userController.js`
- Role: all user/auth business logic.
- Imported by: `userRoutes.js`.
- Depends on: `User`, JWT helper, email utility, Google auth library.
- Data sends/receives:
  - receives credentials/tokens/OTPs
  - returns user session payloads/messages
- Runtime fit: main identity/auth engine.

### `backend/controllers/productController.js`
- Role: list/get/review/suggestions/create product.
- Imported by: `productRoutes.js`.
- Depends on: `Product`.
- Data sends/receives:
  - returns product arrays/docs/suggestions
- Runtime fit: catalog query and write logic.

### `backend/controllers/orderController.js`
- Role: create and manage user orders.
- Imported by: `orderRoutes.js`.
- Depends on: `Order`, `Product`.
- Data sends/receives:
  - receives cart snapshot and totals
  - writes order
  - updates product stock
- Runtime fit: checkout persistence path.

### `backend/models/User.js`
- Role: user schema + password hash/compare behavior.
- Imported by: controllers/middleware/seeder.
- Depends on: `mongoose`, `bcryptjs`.
- Data sends/receives:
  - stores auth/account fields
  - hashes password on save hook
- Runtime fit: user persistence + auth cryptography.

### `backend/models/Product.js`
- Role: product schema and review embedding.
- Imported by: product/order controllers, seeder.
- Depends on: `mongoose`.
- Data sends/receives: catalog and review documents.
- Runtime fit: product persistence model.

### `backend/models/Order.js`
- Role: order schema for checkout state.
- Imported by: order controller, seeder.
- Depends on: `mongoose`.
- Data sends/receives: order items, shipping, totals, status.
- Runtime fit: order persistence model.

### `backend/utils/sendEmail.js`
- Role: SMTP email sender.
- Imported by: `userController.js`.
- Depends on: `nodemailer`, SMTP env vars.
- Data sends/receives: outgoing OTP/password-reset emails.
- Runtime fit: external notification bridge.

### `backend/seeder.js`
- Role: import/destroy seed data.
- Imported by: npm scripts (`data:import`, `data:destroy`).
- Depends on: data files + models + DB connector.
- Data sends/receives: bulk DB writes/deletes.
- Runtime fit: local/dev dataset setup.

---

# 8. Data flow scenarios

Each scenario traces the exact file chain.

## Scenario A: Home page product load

- User action: opens `/`
- Frontend file(s): `App.jsx` -> `HomePage.jsx`
- API request: `GET /api/products?limit=200`
- Backend route file: `routes/productRoutes.js`
- Controller file: `controllers/productController.js` (`getProducts`)
- Model file: `models/Product.js`
- Database operation: `Product.countDocuments`, `Product.find(...).limit(...).skip(...)`
- Response: `{ products, page, pages }`
- UI update: `HomePage` stores products in state, computes filtered `displayedProducts`, renders cards

## Scenario B: Navbar search suggestions

- User action: types in navbar search input
- Frontend file(s): `components/Navbar.jsx` debounce effect
- API request: `GET /api/products/search/suggestions?q=<text>`
- Backend route file: `routes/productRoutes.js`
- Controller file: `controllers/productController.js` (`getProductSuggestions`)
- Model file: `models/Product.js`
- Database operation: regex query on `name`/`category`, select only needed fields, limit
- Response: array of strings (deduplicated suggestions)
- UI update: dropdown suggestion list shown; click navigates to `/?keyword=...`

## Scenario C: Email signup + OTP verification

- User action: submit register form
- Frontend file(s): `RegisterPage.jsx` -> `AuthContext.register`
- API request: `POST /api/users` with `{name,email,password,captchaToken}`
- Backend route file: `routes/userRoutes.js`
- Controller file: `controllers/userController.js` (`registerUser`)
- Model file: `models/User.js`
- Database operation:
  - find existing user by email
  - create/update unverified user with OTP + expiry
  - save user
- External service: `utils/sendEmail.js` sends OTP
- Response: `{ status: 'pending_verification', email }`
- UI update: navigate to `/verify` with `location.state.email`

Then:
- User action: enters OTP on verify page
- Frontend file(s): `OTPVerificationPage.jsx` -> `AuthContext.verifyOTP`
- API request: `POST /api/users/verify` with `{email, otpCode}`
- Backend chain: `userRoutes.js` -> `userController.verifyOTP` -> `User.findOne` -> save verified user
- Response: user payload + JWT
- UI update: `AuthContext` stores `userInfo` in state/localStorage; navigate `/`
## Scenario D: Google login + forced set password

- User action: clicks Google sign-in
- Frontend file(s): `LoginPage.jsx` or `RegisterPage.jsx` -> `AuthContext.googleLogin`
- API request: `POST /api/users/google` with Google token
- Backend route/controller: `userRoutes.js` -> `userController.googleAuth`
- External service: Google token verification or userinfo endpoint
- Model file: `User.js`
- DB operation: find/create user by email
- Response: user payload with `needsPassword: !user.password`
- UI update:
  - If `needsPassword` true, app redirects to `/setpassword` (route guard in `App.jsx`)
  - `SetPasswordPage.jsx` posts to `/api/users/setpassword` with bearer token
  - backend `setGooglePassword` saves hashed password
  - frontend updates local `userInfo.needsPassword = false`

## Scenario E: Cart checkout (current direct modal flow)

- User action: on `CartPage`, clicks checkout then confirms payment
- Frontend file(s): `CartPage.jsx`
- API request: `POST /api/orders`
- Backend route file: `routes/orderRoutes.js` (protected)
- Middleware: `authMiddleware.protect` validates JWT and sets `req.user`
- Controller file: `orderController.addOrderItems`
- Model files: `Order.js`, `Product.js`
- Database operation:
  - create and save order
  - loop order items and decrement `Product.countInStock`
- Response: created order document
- UI update: cart cleared, modal closes, navigate `/orders`

## Scenario F: Mark order as received

- User action: click �Received� on `OrdersPage`
- Frontend file(s): `OrdersPage.jsx`
- API request: `PUT /api/orders/:id/deliver`
- Backend route file: `routes/orderRoutes.js`
- Middleware: `protect`
- Controller file: `orderController.markOrderAsReceived`
- Model file: `Order.js`
- Database operation: find order, verify ownership, set `isDelivered` and `deliveredAt`, save
- Response: updated order
- UI update: refresh `GET /api/orders/myorders`, order leaves �current orders� list

## Scenario G: Forgot password + reset via OTP

- User action: submit email in forgot password
- Frontend file(s): `ForgotPasswordPage.jsx`
- API request: `POST /api/users/forgotpassword` with `{email,captchaToken}`
- Backend chain: `userRoutes.js` -> `userController.forgotPassword` -> `User.findOne` -> save reset token/expiry -> `sendEmail`
- Response: success message
- UI update: navigate `/resetpassword` with email in navigation state

Then:
- User action: submit OTP + new password
- Frontend file(s): `ResetPasswordPage.jsx`
- API request: `POST /api/users/resetpassword`
- Backend chain: `userController.resetPassword` -> find matching user by email+OTP+expiry -> save new hashed password
- Response: success message
- UI update: redirect to `/login`

---

# 9. Authentication and authorization

## Signup/login

### Email/password login
- Frontend: `LoginPage` -> `AuthContext.login`
- Backend: `authUser` in `userController`
- Steps:
  1. verify reCAPTCHA
  2. find user by email
  3. compare bcrypt password (`user.matchPassword`)
  4. issue JWT

### Email signup with OTP verification
- `registerUser` creates/updates unverified user with OTP
- Email sent
- `verifyOTP` validates code and marks `isVerified=true`
- JWT returned after verification

## JWT/token handling

- Token created by `utils/generateToken.js` (30-day expiry)
- Token stored in frontend `localStorage.userInfo.token`
- Axios interceptor sends bearer token on each request
- Backend `protect` middleware validates token and loads `req.user`

## Protected routes/pages

Backend protected endpoints use `protect` middleware.
Frontend has local checks on some pages, but not a single centralized private route wrapper.

## Role checks

- Backend has `admin` middleware.
- Only route using it currently: `POST /api/products` create product.
- Frontend has no admin UI route in this code.

## Google auth / OTP / email verification

- Google auth:
  - `POST /api/users/google`
  - supports ID token and access token paths
- OTP verification:
  - signup verify: `/api/users/verify`
  - forgot-password OTP: `/api/users/forgotpassword` + `/api/users/resetpassword`
- Email delivery:
  - via nodemailer SMTP in `utils/sendEmail.js`

---

# 10. Model and database relationships

## `User` model
Represents account identity.

Fields include:
- profile: `name`, `email`
- auth: `password`, `isAdmin`
- verification/reset: `isVerified`, `otpCode`, `otpExpire`, `resetPasswordToken`, `resetPasswordExpire`

Behavior:
- pre-save hash for `password`
- `matchPassword` method for bcrypt compare

Used by controllers:
- `userController` for all auth/account flows
- `authMiddleware` to attach user from token

## `Product` model
Represents catalog items.

Fields include:
- product basics: `name`, `image`, `brand`, `category`, `description`
- commerce: `price`, `countInStock`
- reviews: embedded review objects with `user` reference

Used by controllers:
- `productController` for listing/details/suggestions/reviews
- `orderController` to decrement stock on order placement

## `Order` model
Represents user purchase snapshots.

Fields include:
- `user` reference
- `orderItems[]` with embedded product snapshot + product ref
- `shippingAddress`, `paymentMethod`, `paymentResult`
- totals: `taxPrice`, `shippingPrice`, `totalPrice`
- status: `isPaid`, `paidAt`, `isDelivered`, `deliveredAt`

Used by controllers:
- `orderController` for create/get/myorders/deliver

Relationship summary:
- A `User` can have many `Order`s.
- An `Order` contains many items each linked to a `Product`.
- `Product` embeds many reviews, each review linked to a `User`.

---
# 11. Environment/config flow

## Backend env vars

Read in `server.js`, `db.js`, `userController.js`, `sendEmail.js`, `paymentController.js`.

Used keys:
- `PORT`
- `NODE_ENV`
- `MONGO_URI`
- `JWT_SECRET`
- `ALLOW_START_WITHOUT_DB`
- `RECAPTCHA_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
- `STRIPE_PUBLIC_KEY`, `PAYPAL_CLIENT_ID`

Flow examples:
- `MONGO_URI` -> `config/db.js` for Mongo connection
- `JWT_SECRET` -> token sign/verify
- SMTP vars -> `sendEmail` transport
- reCAPTCHA secret -> CAPTCHA verification API call
- payment keys -> `/api/payment/config` response

## Frontend env vars

Used keys:
- `VITE_API_URL` (`utils/api.js`)
- `VITE_GOOGLE_CLIENT_ID` (`App.jsx`)
- `VITE_RECAPTCHA_SITE_KEY` (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`)

Important behavior:
- If `VITE_API_URL` is set (e.g., `http://localhost:5000`), Axios calls backend directly.
- If not set, calls are relative and can rely on Vite proxy from `vite.config.js`.

---

# 12. Error flow

## Backend error handling

Current style:
- `try/catch` inside each controller
- returns JSON like `{ message: error.message }`

No global error middleware is present, so behavior varies per controller.

Common status patterns:
- `400` invalid input/business rule
- `401` auth failure
- `404` missing resource
- `500` server exceptions

Known issue:
- In `markOrderAsReceived`, an intended `401`/`404` can become `500` because thrown errors are caught and always returned with status 500.

## Frontend error handling

Current style:
- local `errorMsg` state in forms/pages
- `alert(...)` in some checkout/order actions
- console logging for some API failures

No centralized frontend error boundary or toast system.

---

# 13. Local setup guide

## Prerequisites
- Node.js 20+
- npm
- MongoDB local or Atlas connection string

## 1) Install dependencies

From `Quad-Tech`:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## 2) Configure environment files

Create/edit:
- `backend/.env`
- `frontend/.env`

At minimum:

```env
# backend/.env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongo_uri
JWT_SECRET=your_jwt_secret
ALLOW_START_WITHOUT_DB=false
```

```env
# frontend/.env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

If using OTP/email and CAPTCHA:
- configure SMTP and `RECAPTCHA_SECRET_KEY` in backend env

## 3) (Optional) seed sample data

From `backend/`:

```powershell
npm run data:import
```

## 4) Run backend

```powershell
cd backend
npm run dev
```

## 5) Run frontend

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## 6) Verify

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5000`
- Health: `http://127.0.0.1:5000/api/health`

---

# 14. Common confusion points for MERN beginners (specific to this repo)

1. **Two checkout paths exist**
- `CartPage` directly places order via modal.
- `ShippingPage`/`PaymentPage`/`PlaceOrderPage` also exist but are not the main path from cart button.

2. **Payment API is scaffolded but unused by frontend**
- `/api/payment/*` routes are registered but no frontend page calls them.

3. **Theme provider is duplicated**
- Wrapped in both `main.jsx` and `App.jsx`.

4. **Protected routes are not centralized**
- Some pages manually check auth in `useEffect`; there is no universal `<PrivateRoute />`.

5. **Seed users are likely not login-ready**
- `data/users.js` includes plain text passwords and imports bcrypt without using it.
- `seeder.js` uses `insertMany`; beginners may expect save hooks to hash passwords automatically.

6. **Profile update UI is simulated**
- `ProfilePage` has update form but backend update call is commented as future work.

7. **Footer links don�t match routes**
- `/products` and `/about` links exist but no matching routes in `App.jsx`.

8. **`ALLOW_START_WITHOUT_DB=true` can hide DB problems**
- Backend can start while DB features fail at runtime.

9. **Order creation marks orders paid immediately**
- `addOrderItems` sets `isPaid=true` regardless of real gateway.

10. **Error handling is inconsistent**
- Mix of inline text errors, `alert`, and console logs on frontend.

---

# 15. Final architecture summary

This project is a split MERN app where:

- The **React frontend** controls user interactions, state, and route navigation.
- It sends HTTP requests through a shared Axios client that can attach JWT auth automatically.
- The **Express backend** receives those requests, checks auth where needed, and forwards work to controllers.
- Controllers use **Mongoose models** to read/write MongoDB documents for users, products, and orders.
- Some flows also call external services:
  - Google (OAuth and reCAPTCHA)
  - SMTP (OTP emails)

For a new contributor, the practical runtime path is:

1. Start at `frontend/src/App.jsx` to understand pages.
2. Follow a page�s API call in `frontend/src/utils/api.js`.
3. Match endpoint in `backend/routes/*.js`.
4. Read business logic in `backend/controllers/*.js`.
5. Confirm data shape in `backend/models/*.js`.

That path explains almost every feature end-to-end in this codebase.

---

## Inconsistencies / dead code / outdated pieces found

- Duplicate `ThemeProvider` nesting (`main.jsx` + `App.jsx`)
- Unused/unfinished payment integration (`paymentRoutes` not used by frontend)
- `ProfilePage` update logic is simulated, not wired to backend
- Footer links include routes not defined in router
- Seed user password setup appears inconsistent with bcrypt-based login expectations
- `markOrderAsReceived` error status handling may return 500 where 401/404 is intended
