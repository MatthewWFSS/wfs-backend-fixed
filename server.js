import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

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
  message: { error: 'Too many requests, try again later.' }
}));

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Payment complete:', event.data.object);
      break;
    case 'identity.verification_session.verified':
      console.log('✅ Identity verified:', event.data.object);
      break;
    case 'identity.verification_session.requires_input':
      console.log('⚠️ Identity requires input:', event.data.object);
      break;
    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const USERS_FILE = path.join(process.cwd(), 'users.json');

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return Array.isArray(JSON.parse(data)) ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/api/signup', (req, res) => {
  const { fullName, dob, address, email, phone, password } = req.body;
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields', success: false });
  }

  const users = readUsers();
  if (users.some(u => u.email === email)) {
    return res.status(409).json({ error: 'User already exists', success: false });
  }

  const newUser = {
    id: `user_${users.length + 1}`,
    fullName,
    dob,
    address,
    email,
    phone,
    password,
    safetyScore: 600,
    spending: 0
  };

  users.push(newUser);
  writeUsers(users);
  res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) return res.status(401).json({ error: 'Invalid credentials', success: false });
  res.json({ success: true, user });
});

app.get('/api/admin/summary', (req, res) => {
  const users = readUsers();
  const totalUsers = users.length;

  const avgSafetyScore = totalUsers
    ? Math.round(users.reduce((sum, u) => sum + (u.safetyScore || 0), 0) / totalUsers)
    : 0;

  const totalSpending = totalUsers
    ? users.reduce((sum, u) => sum + (u.spending || 0), 0)
    : 0;

  res.json({ users, totalUsers, avgSafetyScore, totalSpending });
});

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { amount = 50000, currency = 'usd', customer_email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: 'WFS&S Virtual Card Setup',
            description: 'Service Now, Pay Later',
            images: ['https://example.com/wfss-logo.png']
          },
          unit_amount: amount
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: 'https://wfss-frontend.netlify.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://wfss-frontend.netlify.app/cancel',
      customer_email,
      metadata: { service: 'virtual_card_setup' },
      automatic_tax: { enabled: true }
    });

    res.json({ sessionId: session.id, url: session.url, success: true });
  } catch (error) {
    console.error('Checkout error:', error.message);
    res.status(400).json({ error: error.message, success: false });
  }
});

app.post('/api/stripe/create-identity-session', async (req, res) => {
  try {
    const { return_url } = req.body;

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      return_url: return_url || 'https://wfss-frontend.netlify.app/verification-complete'
    });

    res.json({ sessionId: session.id, url: session.url, client_secret: session.client_secret, success: true });
  } catch (error) {
    console.error('Identity error:', error.message);
    res.status(400).json({ error: error.message, success: false });
  }
});

app.post('/api/refund-payment', async (req, res) => {
  try {
    const { payment_intent_id, amount, reason = 'requested_by_customer' } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id required', success: false });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      amount,
      reason
    });

    res.json({ refund_id: refund.id, amount: refund.amount, status: refund.status, success: true });
  } catch (error) {
    console.error('Refund error:', error.message);
    res.status(400).json({ error: error.message, success: false });
  }
});

app.get('/api/terms', (req, res) => {
  res.json({ title: 'Terms of Use', content: '...', last_updated: '2025-06-29' });
});

app.get('/api/privacy', (req, res) => {
  res.json({ title: 'Privacy Policy', content: '...', last_updated: '2025-06-29' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'WFS&S', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'WFS&S Backend API is running.', timestamp: new Date().toISOString() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WFS&S Backend API running on port ${PORT}`);
});

export default app;
