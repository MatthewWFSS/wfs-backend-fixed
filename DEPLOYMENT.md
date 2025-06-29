# WFS&S Backend Deployment Guide

Complete deployment instructions for the WFS&S backend API with Stripe integration.

## 🚀 Quick Deploy to Render.com

### 1. Deploy from GitHub
1. Push this backend folder to a GitHub repository
2. Connect to Render.com
3. Create new Web Service
4. Select your repository
5. Use these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

### 2. Environment Variables (Required)
Set these in your Render dashboard:

```env
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_from_stripe_dashboard
NODE_ENV=production
PORT=3000
```

### 3. Verify Deployment
Your backend will be available at: `https://your-app-name.onrender.com`

Test endpoints:
- `GET /api/health` - Should return `{"status": "ok"}`
- `GET /api/test` - Shows all available endpoints

## 🔗 Frontend Integration

Your frontend at `https://wfss-frontend.netlify.app` is already configured to connect to:
```
https://wfs-backend.onrender.com
```

If you deploy to a different URL, update the frontend's `script.js`:
```javascript
const API_BASE = 'https://your-new-backend-url.onrender.com';
```

## 🎨 Color Scheme Compatibility

The backend responses are designed to work with the WFS&S brand colors:
- **Primary Red**: #DC2626 (main brand color)
- **Black**: #000000 (professional text)
- **Gray Tones**: #1F1F1F, #4B5563, #9CA3AF (UI elements)

## 📋 Stripe Configuration

### 1. Dashboard Setup
1. Get your Stripe secret key from: https://dashboard.stripe.com/apikeys
2. Create a webhook endpoint at: `https://your-backend.onrender.com/api/stripe/webhook`
3. Copy the webhook secret to your environment variables

### 2. Webhook Events
Enable these events in your Stripe webhook:
- `checkout.session.completed`
- `identity.verification_session.verified`
- `identity.verification_session.requires_input`

### 3. Test Mode vs Live Mode
- Use `sk_test_...` keys for testing
- Use `sk_live_...` keys for production
- Frontend buttons will work with both test and live keys

## 🛡️ Security Features

### CORS Configuration
Already configured for:
- `https://*.netlify.app` (your frontend)
- `http://localhost:3000` (local development)

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable in environment variables

### Security Headers
- Helmet.js protection
- XSS prevention
- Content Security Policy

## 📊 API Endpoints Reference

### Payment Processing
```bash
POST /api/stripe/create-checkout-session
Body: { "amount": 50000, "currency": "usd", "customer_email": "user@example.com" }
Response: { "sessionId": "cs_test_...", "url": "https://checkout.stripe.com/...", "success": true }
```

### Identity Verification
```bash
POST /api/stripe/create-identity-session
Body: { "return_url": "https://wfss-frontend.netlify.app/verification-complete" }
Response: { "sessionId": "vs_test_...", "url": "https://verify.stripe.com/...", "success": true }
```

### Refund Processing
```bash
POST /api/refund-payment
Body: { "payment_intent_id": "pi_test_...", "amount": 2500 }
Response: { "refund_id": "re_test_...", "amount": 2500, "status": "succeeded", "success": true }
```

## 🔧 Troubleshooting

### Common Issues

**1. 404 on Stripe endpoints**
- Check environment variables are set correctly
- Verify Stripe secret key format (`sk_test_...` or `sk_live_...`)

**2. CORS errors from frontend**
- Ensure backend URL matches frontend API_BASE
- Check CORS origin configuration in server.js

**3. Webhook failures**
- Verify webhook secret matches Stripe dashboard
- Check webhook URL is accessible: `POST /api/stripe/webhook`

**4. Rate limiting errors**
- Reduce request frequency
- Check rate limit configuration

### Debug Steps
1. Check health endpoint: `GET /api/health`
2. Verify all endpoints: `GET /api/test`
3. Test Stripe connection with a simple checkout session
4. Check server logs in Render dashboard

## 📞 Support

For deployment issues:
1. Check Render logs for error details
2. Test individual endpoints with curl
3. Verify Stripe dashboard configuration
4. Ensure environment variables are correctly set

---

**Backend is ready for production deployment with full Stripe integration!**