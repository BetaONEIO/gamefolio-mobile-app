import { Router, Request, Response } from 'express';
import express from 'express';
import { db } from '../db';
import { gfOrders, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getUncachableStripeClient, getStripeSecretKey } from '../stripeClient';
import { transferGfTokens } from '../gf-token-service';
import { EmailService } from '../email-service';
import Stripe from 'stripe';

const router = Router();

async function getWebhookSecret(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector credentials not available');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];
  
  if (!connectionSettings?.settings?.webhook_secret) {
    throw new Error('Stripe webhook secret not found');
  }

  return connectionSettings.settings.webhook_secret;
}

async function updateOrderStatus(
  orderId: string, 
  status: string, 
  updates: { txHash?: string; errorReason?: string; stripePaymentIntentId?: string } = {}
) {
  await db.update(gfOrders)
    .set({ 
      status, 
      updatedAt: new Date(),
      ...updates 
    })
    .where(eq(gfOrders.id, orderId));
}

async function processGfOrderDelivery(sessionId: string, paymentIntentId?: string): Promise<void> {
  console.log(`[GF Webhook] Processing order for session: ${sessionId}`);

  const [order] = await db.select()
    .from(gfOrders)
    .where(eq(gfOrders.stripeSessionId, sessionId));

  if (!order) {
    console.log(`[GF Webhook] No order found for session: ${sessionId}`);
    return;
  }

  console.log(`[GF Webhook] Found order ${order.id} with status: ${order.status}`);

  const terminalStatuses = ['delivered', 'delivering', 'paid'];
  if (terminalStatuses.includes(order.status)) {
    console.log(`[GF Webhook] Order ${order.id} already processed (status: ${order.status}), skipping`);
    return;
  }

  await updateOrderStatus(order.id, 'paid', { 
    stripePaymentIntentId: paymentIntentId || undefined 
  });
  console.log(`[GF Webhook] Order ${order.id} marked as paid`);

  if (order.status !== 'credited') {
    try {
      const [currentUser] = await db.select({ gfTokenBalance: users.gfTokenBalance }).from(users).where(eq(users.id, order.userId!));
      if (currentUser) {
        await db.update(users)
          .set({ gfTokenBalance: currentUser.gfTokenBalance + order.gfAmount })
          .where(eq(users.id, order.userId!));
        console.log(`[GF Webhook] Credited ${order.gfAmount} GFT to user ${order.userId} (off-chain)`);
      }
    } catch (balanceError: any) {
      console.error(`[GF Webhook] Failed to credit off-chain balance for order ${order.id}:`, balanceError);
    }
  }

  if (!order.walletAddress) {
    await updateOrderStatus(order.id, 'credited', { 
      stripePaymentIntentId: paymentIntentId || undefined 
    });
    console.log(`[GF Webhook] Order ${order.id} credited (no wallet for on-chain transfer)`);
    return;
  }

  await updateOrderStatus(order.id, 'delivering');
  console.log(`[GF Webhook] Order ${order.id} status set to delivering`);

  try {
    const result = await transferGfTokens(order.walletAddress, order.gfAmount);

    if (result.success && result.txHash) {
      await updateOrderStatus(order.id, 'delivered', { txHash: result.txHash });
      console.log(`[GF Webhook] Order ${order.id} delivered successfully. TxHash: ${result.txHash}`);
    } else {
      await updateOrderStatus(order.id, 'credited', { 
        errorReason: result.error || 'On-chain transfer failed but off-chain balance credited',
        txHash: result.txHash 
      });
      console.error(`[GF Webhook] Order ${order.id} on-chain delivery failed (off-chain credited): ${result.error}`);
    }
  } catch (error: any) {
    await updateOrderStatus(order.id, 'credited', { 
      errorReason: error.message || 'On-chain transfer error but off-chain balance credited' 
    });
    console.error(`[GF Webhook] Order ${order.id} on-chain delivery error (off-chain credited):`, error);
  }
}

router.post('/api/stripe/webhook', 
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[GF Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    if (!Buffer.isBuffer(req.body)) {
      console.error('[GF Webhook] Request body is not a Buffer - ensure webhook route is before express.json()');
      return res.status(500).json({ error: 'Webhook processing error' });
    }

    let event: Stripe.Event;

    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = await getWebhookSecret();
      const sig = Array.isArray(signature) ? signature[0] : signature;

      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (error: any) {
      console.error('[GF Webhook] Signature verification failed:', error.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
    }

    console.log(`[GF Webhook] Received event: ${event.type}`);

    res.status(200).json({ received: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (session.metadata?.gfAmount) {
        try {
          await processGfOrderDelivery(
            session.id, 
            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
          );
        } catch (error) {
          console.error('[GF Webhook] Error processing order delivery:', error);
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      if (paymentIntent.metadata?.gfAmount) {
        try {
          await processGfOrderDelivery(
            paymentIntent.id,
            paymentIntent.id
          );
        } catch (error) {
          console.error('[GF Webhook] Error processing PaymentIntent order delivery:', error);
        }
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

      if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
        try {
          console.log(`[GF Webhook] Processing renewal for subscription: ${subscriptionId}`);

          const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

          if (user) {
            const plan = user.proSubscriptionType as 'monthly' | 'yearly' || 'monthly';
            const newEndDate = plan === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await db.update(users).set({
              isPro: true,
              proSubscriptionEndDate: newEndDate,
              updatedAt: new Date(),
            }).where(eq(users.id, user.id));

            console.log(`[GF Webhook] Renewed Pro for user ${user.id} until ${newEndDate.toISOString()}`);

            if (user.email) {
              const nextRenewal = newEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              EmailService.sendSubscriptionRenewedEmail(
                user.email,
                user.username || user.displayName || 'Gamer',
                plan,
                nextRenewal
              ).catch(err => console.error('[GF Webhook] Failed to send renewal email:', err));
            }
          } else {
            console.warn(`[GF Webhook] No user found for subscription: ${subscriptionId}`);
          }
        } catch (error) {
          console.error('[GF Webhook] Error processing invoice.paid:', error);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionId = subscription.id;

      try {
        console.log(`[GF Webhook] Processing subscription deletion: ${subscriptionId}`);

        const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

        if (user) {
          await db.update(users).set({
            isPro: false,
            stripeSubscriptionId: null,
            proSubscriptionType: null,
            proSubscriptionEndDate: null,
            updatedAt: new Date(),
          }).where(eq(users.id, user.id));

          console.log(`[GF Webhook] Removed Pro status for user ${user.id} (subscription deleted)`);

          if (user.email) {
            EmailService.sendProCancelledEmail(
              user.email,
              user.username || user.displayName || 'Gamer',
              new Date()
            ).catch(err => console.error('[GF Webhook] Failed to send cancellation email:', err));
          }
        } else {
          console.warn(`[GF Webhook] No user found for deleted subscription: ${subscriptionId}`);
        }
      } catch (error) {
        console.error('[GF Webhook] Error processing subscription deletion:', error);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

      if (subscriptionId) {
        try {
          console.log(`[GF Webhook] Payment failed for subscription: ${subscriptionId}`);

          const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

          if (user && user.email) {
            EmailService.sendPaymentFailedEmail(
              user.email,
              user.username || user.displayName || 'Gamer'
            ).catch(err => console.error('[GF Webhook] Failed to send payment failed email:', err));

            console.log(`[GF Webhook] Payment failed notification sent to user ${user.id}`);
          }
        } catch (error) {
          console.error('[GF Webhook] Error processing payment_failed:', error);
        }
      }
    }
  }
);

export default router;
