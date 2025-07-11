import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// ✅ Security middleware
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ✅ Webhook route comes FIRST, using raw body
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

  // ✅ Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Payment success:', event.data.object);
      break;
    case 'identity.verification_session.verified':
      console.log('✅ Identity verified:', event.data.object);
      break;
    case 'identity.verification_session.requires_input':
      console.log('⚠️ Identity needs input:', event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// ✅ AFTER webhook, use JSON parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'WFS&S Backend API',
    version: '1.0.0'
  });
});

// ✅ Create Stripe Checkout session
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
            description: 'Service Now, Pay Later - Virtual Credit Card',
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
      metadata: {
        service: 'virtual_card_setup',
        provider: 'wfss'
      },
      automatic_tax: {
        enabled: true
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      success: true
    });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(400).json({ error: error.message, success: false });
  }
});

// ✅ Create Stripe Identity session
app.post('/api/stripe/create-identity-session', async (req, res) => {
  try {
    const { return_url } = req.body;

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        service: 'wfss_identity_verification',
        timestamp: new Date().toISOString()
      },
      return_url: return_url || 'https://wfss-frontend.netlify.app/verification-complete'
    });

    res.json({
      sessionId: verificationSession.id,
      url: verificationSession.url,
      client_secret: verificationSession.client_secret,
      success: true
    });
  } catch (error) {
    console.error('Stripe Identity Error:', error);
    res.status(400).json({ error: error.message, success: false });
  }
});

// ✅ Refund route
app.post('/api/refund-payment', async (req, res) => {
  try {
    const { payment_intent_id, amount, reason = 'requested_by_customer' } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id is required', success: false });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      amount,
      reason,
      metadata: {
        service: 'wfss_refund',
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      refund_id: refund.id,
      amount: refund.amount,
      status: refund.status,
      success: true
    });
  } catch (error) {
    console.error('Refund Error:', error);
    res.status(400).json({ error: error.message, success: false });
  }
});

// ✅ Legal docs
app.get('/api/terms', (req, res) => {
  res.json({
    title: 'WFS&S Terms of Use',
    content: 'Terms of service content here...',
    last_updated: '2025-06-29',
    jurisdiction: 'Arizona, USA'
  });
});

app.get('/api/privacy', (req, res) => {
  res.json({
    title: 'WFS&S Privacy Policy',
    content: 'Privacy policy content here...',
    last_updated: '2025-06-29',
    contact: 'privacy@wfss.com'
  });
});

// ✅ Diagnostic
app.get('/api/test', (req, res) => {
  res.json({
    message: 'WFS&S Backend API is working!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/health',
      'POST /api/stripe/create-checkout-session',
      'POST /api/stripe/create-identity-session',
      'POST /api/stripe/webhook',
      'POST /api/refund-payment',
      'GET /api/terms',
      'GET /api/privacy'
    ]
  });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!', success: false });
});

// ✅ 404 fallback
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api/health',
      'POST /api/stripe/create-checkout-session',
      'POST /api/stripe/create-identity-session',
      'POST /api/stripe/webhook',
      'POST /api/refund-payment',
      'GET /api/terms',
      'GET /api/privacy',
      'GET /api/test'
    ]
  });
});

// ✅ Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WFS&S Backend API running on port ${PORT}`);
});

export default app;
