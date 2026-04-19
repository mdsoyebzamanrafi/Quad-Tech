# Backend Setup

## Install
```powershell
npm install
```

## Environment (`.env`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/quad_tech
JWT_SECRET=replace_with_a_long_random_secret
ALLOW_START_WITHOUT_DB=true

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

## Run
```powershell
npm start
```

## Health check
```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing
```
