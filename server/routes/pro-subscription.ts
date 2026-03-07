import { Router, Request, Response } from 'express';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hybridAuth } from '../middleware/hybrid-auth';
import { EmailService } from '../email-service';
import { storage } from '../storage';

const router = Router();

const cachedPriceIds: { monthly: string | null; yearly: string | null } = {
  monthly: null,
  yearly: null,
};

async function getOrCreatePriceId(stripe: any, plan: 'monthly' | 'yearly'): Promise<string> {
  if (plan === 'monthly' && cachedPriceIds.monthly) return cachedPriceIds.monthly;
  if (plan === 'yearly' && cachedPriceIds.yearly) return cachedPriceIds.yearly;

  const envPriceId = plan === 'monthly'
    ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
    : process.env.STRIPE_PRO_YEARLY_PRICE_ID;

  if (envPriceId) {
    try {
      await stripe.prices.retrieve(envPriceId);
      if (plan === 'monthly') cachedPriceIds.monthly = envPriceId;
      else cachedPriceIds.yearly = envPriceId;
      return envPriceId;
    } catch (e: any) {
      console.warn(`Configured price ID ${envPriceId} not found in connected Stripe account. Auto-provisioning...`);
    }
  }

  const existingProducts = await stripe.products.list({ limit: 100 });
  let product = existingProducts.data.find((p: any) => p.name === 'Gamefolio Pro' && p.active);

  if (!product) {
    product = await stripe.products.create({
      name: 'Gamefolio Pro',
      description: 'Premium subscription for Gamefolio - unlock all Pro features',
      metadata: { app: 'gamefolio' },
    });
    console.log(`✅ Created Stripe product: ${product.id}`);
  }

  const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

  const targetAmount = plan === 'monthly' ? 299 : 3000;
  const targetInterval = plan === 'monthly' ? 'month' : 'year';

  let price = existingPrices.data.find((p: any) =>
    p.unit_amount === targetAmount &&
    p.currency === 'gbp' &&
    p.recurring?.interval === targetInterval
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: targetAmount,
      currency: 'gbp',
      recurring: { interval: targetInterval },
      metadata: { plan, app: 'gamefolio' },
    });
    console.log(`✅ Created Stripe price for ${plan}: ${price.id} (£${targetAmount / 100}/${targetInterval})`);
  }

  if (plan === 'monthly') cachedPriceIds.monthly = price.id;
  else cachedPriceIds.yearly = price.id;

  console.log(`📌 Using Stripe price for ${plan}: ${price.id}`);
  return price.id;
}

router.post('/api/stripe/create-pro-subscription', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { plan } = req.body;
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "monthly" or "yearly".' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Guard: block a new PaymentIntent if the user already has an active subscription
    if (user.isPro && user.stripeSubscriptionId) {
      const stripe = await getUncachableStripeClient();
      try {
        const existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (existing.status === 'active' || existing.status === 'trialing') {
          console.warn(`⚠️ User ${userId} already has active subscription ${user.stripeSubscriptionId} — blocking new PaymentIntent`);
          return res.status(409).json({ error: 'You already have an active Pro subscription.' });
        }
      } catch {
        // Subscription not found in Stripe — allow proceeding
      }
    }

    const stripe = await getUncachableStripeClient();

    const email = user.email;
    if (!email) {
      return res.status(400).json({ error: 'User must have an email address to subscribe' });
    }

    let customerId: string;
    if (user.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else {
      const existingCustomers = await stripe.customers.list({ email, limit: 1 });
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email,
          metadata: { userId: String(userId) },
        });
        customerId = newCustomer.id;
      }
    }

    const priceId = await getOrCreatePriceId(stripe, plan);
    const amount = plan === 'monthly' ? 299 : 3000;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'gbp',
      customer: customerId,
      setup_future_usage: 'off_session',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: String(userId),
        plan,
        priceId,
        type: 'pro_subscription',
      },
    });

    return res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Create pro subscription error:', error);
    return res.status(500).json({
      error: 'Failed to create pro subscription',
      message: error.message,
    });
  }
});

router.post('/api/stripe/confirm-pro-subscription', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { paymentIntentId, plan } = req.body;
    if (!paymentIntentId || !plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid request. Requires paymentIntentId and plan ("monthly" or "yearly").' });
    }

    const stripe = await getUncachableStripeClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not been completed', status: paymentIntent.status });
    }

    if (paymentIntent.metadata.userId !== String(userId)) {
      return res.status(403).json({ error: 'Payment does not belong to this user' });
    }

    // Idempotency guard: if this user already has a subscription tied to this exact PaymentIntent,
    // return success without creating a duplicate
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (currentUser?.stripeSubscriptionId) {
      try {
        const existingSub = await stripe.subscriptions.retrieve(currentUser.stripeSubscriptionId);
        if (existingSub.status === 'active' || existingSub.status === 'trialing') {
          console.log(`ℹ️ confirm-pro-subscription called for user ${userId} who already has active sub ${currentUser.stripeSubscriptionId} — returning success without creating duplicate`);
          return res.json({ success: true, isPro: true, subscriptionId: currentUser.stripeSubscriptionId });
        }
      } catch {
        // Subscription not found in Stripe — proceed to create a new one
      }
    }

    // Also check Stripe directly: look for any existing active subscription on this customer
    // where the payment_intent metadata matches, to catch race conditions
    const customerId = paymentIntent.customer as string;
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });
    const alreadyLinked = existingSubscriptions.data.find(
      (s: any) => s.metadata?.paymentIntentId === paymentIntentId
    );
    if (alreadyLinked) {
      console.log(`ℹ️ confirm-pro-subscription: found existing sub ${alreadyLinked.id} linked to PI ${paymentIntentId} — skipping duplicate creation`);
      await db.update(users).set({
        isPro: true,
        stripeCustomerId: customerId,
        stripeSubscriptionId: alreadyLinked.id,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));
      return res.json({ success: true, isPro: true, subscriptionId: alreadyLinked.id });
    }

    const paymentMethodId = paymentIntent.payment_method as string;
    const priceId = paymentIntent.metadata.priceId;

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }).catch(() => {});

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { userId: String(userId), plan, paymentIntentId },
    });

    await db.update(users).set({
      isPro: true,
      proSubscriptionType: plan,
      proSubscriptionStartDate: new Date(),
      proSubscriptionEndDate: plan === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));
    if (updatedUser?.email) {
      EmailService.sendProWelcomeEmail(
        updatedUser.email,
        updatedUser.username || updatedUser.displayName || 'Gamer',
        plan as 'monthly' | 'yearly'
      ).catch(err => console.error('Failed to send Pro welcome email:', err));
    }

    let lootboxReward = null;
    try {
      const initialGrant = await storage.grantProLootbox(userId, 'initial');
      if (initialGrant) {
        lootboxReward = { reward: initialGrant.reward, isDuplicate: initialGrant.isDuplicate };
        console.log(`🎁 Initial Pro lootbox granted on subscription confirm: ${initialGrant.reward.name}`);
      }
    } catch (lootboxErr) {
      console.error('Failed to grant initial pro lootbox:', lootboxErr);
    }

    return res.json({ success: true, isPro: true, subscriptionId: subscription.id, lootboxReward });
  } catch (error: any) {
    console.error('Confirm pro subscription error:', error);
    return res.status(500).json({
      error: 'Failed to confirm pro subscription',
      message: error.message,
    });
  }
});

export default router;
