import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// ✅ In-memory store for verified users (can be swapped for DB)
const verifiedUsers = new Set();

// ✅ Rate limiting & security
app.use(helmet());
app.use(cors({
  origin: [
    'https://wfss-frontend.netlify.app',
    'https://*.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
}));

// ✅ Stripe Webhook must use raw body BEFORE express.json
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'identity.verification_session.verified': {
      const email = event.data.object?.metadata?.user_email;
      if (email) {
        verifiedUsers.add(email);
        console.log(`✅ Identity verified for: ${email}`);
      }
      break;
    }
    case 'checkout.session.completed': {
      console.log('✅ Payment completed:', event.data.object);
      break;
    }
    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

// ✅ Body parser after webhook
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ Stripe Identity Verification
app.post('/api/stripe/create-identity-session', async (req, res) => {
  try {
    const { email, return_url } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_email: email },
      return_url: return_url || 'https://wfss-frontend.netlify.app/identity-complete.html'
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      success: true
    });
  } catch (err) {
    console.error('Stripe Identity Error:', err.message);
    res.status(400).json({ error: err.message, success: false });
  }
});

// ✅ Stripe Checkout Session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { amount = 1500, customer_email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'WFS&S Virtual Card Access',
            description: 'ID verification + virtual payment access',
          },
          unit_amount: amount
        },
        quantity: 1
      }],
      mode: 'payment',
      customer_email,
      success_url: 'https://wfss-frontend.netlify.app/success.html',
      cancel_url: 'https://wfss-frontend.netlify.app/cancel.html',
    });

    res.json({ sessionId: session.id, url: session.url, success: true });
  } catch (err) {
    console.error('Stripe Checkout Error:', err.message);
    res.status(400).json({ error: err.message, success: false });
  }
});

// ✅ Check if a user is verified (used by mobile app polling)
app.get('/api/user-status', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const verified = verifiedUsers.has(email);
  res.json({ verified });
});

// ✅ Refund route (still valid)
app.post('/api/refund-payment', async (req, res) => {
  try {
    const { payment_intent_id, amount, reason = 'requested_by_customer' } = req.body;
    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id required', success: false });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      amount,
      reason,
      metadata: { refunded_by: 'wfss' }
    });

    res.json({ success: true, refund });
  } catch (err) {
    console.error('Refund Error:', err.message);
    res.status(400).json({ error: err.message, success: false });
  }
});

// ✅ Legal pages
app.get('/api/terms', (req, res) => {
  res.json({ title: 'Terms of Use', content: 'Terms go here', last_updated: '2025-07-01' });
});

app.get('/api/privacy', (req, res) => {
  res.json({ title: 'Privacy Policy', content: 'Privacy goes here', last_updated: '2025-07-01' });
});

// ✅ Fallback 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api/health',
      'POST /api/stripe/create-identity-session',
      'POST /api/stripe/create-checkout-session',
      'GET /api/user-status',
      'POST /api/stripe/webhook'
    ]
  });
});

// ✅ Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WFS&S backend running on port ${PORT}`);
});

export default app;
