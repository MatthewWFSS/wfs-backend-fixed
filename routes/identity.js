const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/api/stripe/create-identity-session', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_email: email },
      return_url: 'https://wfsn.onrender.com/verification-complete',
    });

    res.json({ url: verificationSession.url });
  } catch (err) {
    console.error('[Stripe Identity Error]', err);
    res.status(500).json({ error: 'Failed to create identity verification session' });
  }
});

module.exports = router;
