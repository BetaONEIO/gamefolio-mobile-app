import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { gfOrders, users } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { hybridAuth } from '../middleware/hybrid-auth';
import { getTreasuryBalance, getTreasuryAddress, transferGfTokens } from '../gf-token-service';

const SKALE_NEBULA_TESTNET_CHAIN_ID = 37084624;

const router = Router();

const ALLOWED_GBP_AMOUNTS = [5, 10, 25, 50, 100] as const;
const GF_PRICE_GBP = 0.01; // Fixed price: 1 GF = £0.01

const checkoutSchema = z.object({
  gbpAmount: z.number().refine(
    (val) => ALLOWED_GBP_AMOUNTS.includes(val as any),
    { message: `gbpAmount must be one of: ${ALLOWED_GBP_AMOUNTS.join(', ')}` }
  ),
});

router.post('/api/gf/checkout', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = checkoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    const { gbpAmount } = validation.data;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const walletAddress = user.walletAddress || null;
    const gfAmount = gbpAmount / GF_PRICE_GBP;

    const stripe = await getUncachableStripeClient();

    const getBaseUrl = (req: Request): string => {
      if (process.env.REPLIT_DOMAINS) {
        return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
      }
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.get('host') || 'localhost:5000';
      return `${protocol}://${host}`;
    };
    
    const baseUrl = getBaseUrl(req);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(gbpAmount * 100),
          product_data: {
            name: `${gfAmount.toLocaleString()} GF Tokens`,
            description: `Purchase of ${gfAmount.toLocaleString()} GF tokens at £${GF_PRICE_GBP} each`,
          },
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/gf/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/gf/cancel`,
      metadata: {
        userId: userId.toString(),
        gbpAmount: gbpAmount.toString(),
        gfAmount: gfAmount.toString(),
        priceUsed: GF_PRICE_GBP.toString(),
        walletAddress: walletAddress || '',
      },
    });

    const [order] = await db.insert(gfOrders).values({
      userId,
      walletAddress,
      gbpAmount,
      gfAmount,
      priceUsed: GF_PRICE_GBP,
      status: 'created',
      stripeSessionId: session.id,
    }).returning();

    return res.json({
      orderId: order.id,
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    console.error('GF Checkout error:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
});

router.get('/api/me/wallet', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select({
      walletAddress: users.walletAddress,
      walletChain: users.walletChain,
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      walletAddress: user.walletAddress || null,
      chainId: user.walletAddress ? SKALE_NEBULA_TESTNET_CHAIN_ID : null,
    });
  } catch (error: any) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

router.get('/api/gf/orders', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const orders = await db.select({
      id: gfOrders.id,
      gbpAmount: gfOrders.gbpAmount,
      gfAmount: gfOrders.gfAmount,
      status: gfOrders.status,
      txHash: gfOrders.txHash,
      createdAt: gfOrders.createdAt,
    })
    .from(gfOrders)
    .where(eq(gfOrders.userId, userId))
    .orderBy(desc(gfOrders.createdAt))
    .limit(20);

    return res.json(orders);
  } catch (error: any) {
    console.error('Get orders error:', error);
    return res.status(500).json({ error: 'Failed to get orders' });
  }
});

router.get('/api/gf/orders/:id', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const [order] = await db.select({
      id: gfOrders.id,
      gbpAmount: gfOrders.gbpAmount,
      gfAmount: gfOrders.gfAmount,
      status: gfOrders.status,
      txHash: gfOrders.txHash,
      createdAt: gfOrders.createdAt,
    })
    .from(gfOrders)
    .where(and(eq(gfOrders.id, id), eq(gfOrders.userId, userId)));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(order);
  } catch (error: any) {
    console.error('Get order error:', error);
    return res.status(500).json({ error: 'Failed to get order' });
  }
});

router.get('/api/stripe/config', async (_req: Request, res: Response) => {
  try {
    const publishableKey = await getStripePublishableKey();
    return res.json({ publishableKey });
  } catch (error: any) {
    console.error('Failed to get Stripe config:', error);
    return res.status(500).json({ error: 'Failed to load payment configuration' });
  }
});

router.post('/api/gf/create-payment-intent', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = checkoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    const { gbpAmount } = validation.data;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const walletAddress = user.walletAddress || null;
    const gfAmount = gbpAmount / GF_PRICE_GBP;

    const stripe = await getUncachableStripeClient();

    const [order] = await db.insert(gfOrders).values({
      userId,
      walletAddress,
      gbpAmount,
      gfAmount,
      priceUsed: GF_PRICE_GBP,
      status: 'created',
      stripeSessionId: '', // Will be updated after PaymentIntent creation
    }).returning();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(gbpAmount * 100),
      currency: 'gbp',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId.toString(),
        orderId: order.id,
        gbpAmount: gbpAmount.toString(),
        gfAmount: gfAmount.toString(),
        priceUsed: GF_PRICE_GBP.toString(),
        walletAddress: walletAddress || '',
      },
    });

    await db.update(gfOrders)
      .set({ stripeSessionId: paymentIntent.id })
      .where(eq(gfOrders.id, order.id));

    return res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
    });
  } catch (error: any) {
    console.error('Create PaymentIntent error:', error);
    return res.status(500).json({ 
      error: 'Failed to create payment',
      message: error.message 
    });
  }
});

router.post('/api/gf/recover-orders', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pendingOrders = await db.select()
      .from(gfOrders)
      .where(and(
        eq(gfOrders.userId, userId),
        eq(gfOrders.status, 'created')
      ));

    if (pendingOrders.length === 0) {
      return res.json({ recovered: 0, message: 'No pending orders to recover' });
    }

    const stripe = await getUncachableStripeClient();
    let recovered = 0;
    let totalCredited = 0;

    for (const order of pendingOrders) {
      if (!order.stripeSessionId) continue;
      
      try {
        let paymentSucceeded = false;
        
        if (order.stripeSessionId.startsWith('pi_')) {
          const pi = await stripe.paymentIntents.retrieve(order.stripeSessionId);
          paymentSucceeded = pi.status === 'succeeded';
        } else if (order.stripeSessionId.startsWith('cs_')) {
          const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
          paymentSucceeded = session.payment_status === 'paid';
        }

        if (paymentSucceeded) {
          await db.update(gfOrders)
            .set({ status: 'credited', updatedAt: new Date() })
            .where(eq(gfOrders.id, order.id));

          const [currentUser] = await db.select({ gfTokenBalance: users.gfTokenBalance })
            .from(users).where(eq(users.id, userId));
          
          if (currentUser) {
            await db.update(users)
              .set({ gfTokenBalance: currentUser.gfTokenBalance + order.gfAmount })
              .where(eq(users.id, userId));
            totalCredited += order.gfAmount;
          }

          recovered++;
          console.log(`[GF Recovery] Order ${order.id} recovered and credited ${order.gfAmount} GFT to user ${userId}`);
        }
      } catch (err: any) {
        console.error(`[GF Recovery] Failed to check order ${order.id}:`, err.message);
      }
    }

    return res.json({ recovered, totalCredited, message: `Recovered ${recovered} orders, credited ${totalCredited} GFT` });
  } catch (error: any) {
    console.error('Recover orders error:', error);
    return res.status(500).json({ error: 'Failed to recover orders' });
  }
});

router.post('/api/gf/confirm-payment', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const stripe = await getUncachableStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not succeeded yet', status: paymentIntent.status });
    }

    const [order] = await db.select()
      .from(gfOrders)
      .where(and(
        eq(gfOrders.stripeSessionId, paymentIntentId),
        eq(gfOrders.userId, userId)
      ));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'delivered' || order.status === 'credited') {
      const [user] = await db.select({ gfTokenBalance: users.gfTokenBalance }).from(users).where(eq(users.id, userId));
      return res.json({ 
        success: true, 
        alreadyProcessed: true, 
        gfAmount: order.gfAmount,
        newBalance: user?.gfTokenBalance || 0
      });
    }

    const [currentUser] = await db.select({ 
      gfTokenBalance: users.gfTokenBalance, 
      walletAddress: users.walletAddress 
    }).from(users).where(eq(users.id, userId));

    const [updatedUser] = await db.update(users)
      .set({ 
        gfTokenBalance: currentUser.gfTokenBalance + order.gfAmount
      })
      .where(eq(users.id, userId))
      .returning({ gfTokenBalance: users.gfTokenBalance });

    let txHash: string | undefined;
    let onChainSuccess = false;

    if (currentUser.walletAddress) {
      console.log(`[GF Confirm] Attempting on-chain transfer of ${order.gfAmount} GFT to ${currentUser.walletAddress}`);
      try {
        const result = await transferGfTokens(currentUser.walletAddress, order.gfAmount);
        if (result.success) {
          txHash = result.txHash;
          onChainSuccess = true;
          console.log(`[GF Confirm] On-chain transfer successful. TxHash: ${txHash}`);
        } else {
          console.error(`[GF Confirm] On-chain transfer failed: ${result.error}`);
        }
      } catch (transferError: any) {
        console.error(`[GF Confirm] On-chain transfer error:`, transferError.message);
      }
    }

    await db.update(gfOrders)
      .set({ 
        status: onChainSuccess ? 'delivered' : 'credited', 
        stripePaymentIntentId: paymentIntentId,
        txHash: txHash,
        updatedAt: new Date() 
      })
      .where(eq(gfOrders.id, order.id));

    console.log(`[GF Confirm] Order ${order.id} ${onChainSuccess ? 'delivered' : 'credited'}. User ${userId} received ${order.gfAmount} GFT. New balance: ${updatedUser?.gfTokenBalance}`);

    return res.json({ 
      success: true, 
      gfAmount: order.gfAmount,
      newBalance: updatedUser?.gfTokenBalance || 0,
      onChainTransfer: onChainSuccess,
      txHash,
    });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    return res.status(500).json({ error: 'Failed to confirm payment', message: error.message });
  }
});

router.get('/api/wallet/activity', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const orders = await db.select()
      .from(gfOrders)
      .where(eq(gfOrders.userId, userId))
      .orderBy(desc(gfOrders.createdAt))
      .limit(50);

    const activities = orders.map((order) => {
      const statusMap: Record<string, string> = {
        'delivered': 'completed',
        'credited': 'completed',
        'completed': 'completed',
        'delivering': 'processing',
        'created': 'pending',
        'pending': 'pending',
        'paid': 'processing',
        'processing': 'processing',
        'failed': 'failed',
      };

      return {
        id: order.id,
        type: 'purchase' as const,
        title: 'GFT Purchase',
        status: statusMap[order.status] || 'pending',
        amount: order.gfAmount,
        gbpAmount: order.gbpAmount,
        isPositive: true,
        date: order.createdAt.toISOString(),
        time: order.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        stripePaymentIntentId: order.stripePaymentIntentId,
        txHash: order.txHash,
        walletAddress: order.walletAddress,
        orderStatus: order.status,
      };
    });

    return res.json({ activities });
  } catch (error: any) {
    console.error('Wallet activity error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/api/token/on-chain-balance', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select({
      walletAddress: users.walletAddress,
    }).from(users).where(eq(users.id, userId));

    if (!user?.walletAddress) {
      return res.json({ balance: '0', walletAddress: null, source: 'explorer' });
    }

    const { GF_TOKEN_ADDRESS } = await import('@shared/contracts');
    const explorerBaseUrl = 'https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com';

    const explorerRes = await fetch(
      `${explorerBaseUrl}/api/v2/addresses/${user.walletAddress}/token-balances`
    );

    if (!explorerRes.ok) {
      throw new Error(`Explorer API returned ${explorerRes.status}`);
    }

    const tokenBalances = await explorerRes.json();

    const gfToken = Array.isArray(tokenBalances)
      ? tokenBalances.find((t: any) =>
          t.token?.address?.toLowerCase() === GF_TOKEN_ADDRESS.toLowerCase()
        )
      : null;

    const rawBalance = gfToken?.value || '0';
    const decimals = parseInt(gfToken?.token?.decimals || '18', 10);
    const balance = (Number(rawBalance) / Math.pow(10, decimals)).toString();

    return res.json({
      balance,
      walletAddress: user.walletAddress,
      source: 'explorer',
      explorerUrl: `${explorerBaseUrl}/address/${user.walletAddress}`,
    });
  } catch (error: any) {
    console.error('Explorer balance error, falling back to RPC:', error.message);

    try {
      const userId = (req as any).user?.id;
      const [user] = await db.select({
        walletAddress: users.walletAddress,
      }).from(users).where(eq(users.id, userId));

      if (!user?.walletAddress) {
        return res.json({ balance: '0', walletAddress: null, source: 'rpc-fallback' });
      }

      const { createPublicClient, http } = await import('viem');
      const { GF_TOKEN_ADDRESS, GF_TOKEN_ABI, SKALE_NEBULA_TESTNET } = await import('@shared/contracts');

      const publicClient = createPublicClient({
        chain: SKALE_NEBULA_TESTNET,
        transport: http(),
      });

      const rawBalance = await publicClient.readContract({
        address: GF_TOKEN_ADDRESS,
        abi: GF_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [user.walletAddress as `0x${string}`],
      });

      const balance = (Number(rawBalance) / Math.pow(10, 18)).toString();

      return res.json({
        balance,
        walletAddress: user.walletAddress,
        source: 'rpc-fallback',
        explorerUrl: `https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/address/${user.walletAddress}`,
      });
    } catch (fallbackError: any) {
      console.error('RPC fallback also failed:', fallbackError.message);
      return res.status(500).json({ error: 'Failed to fetch on-chain balance' });
    }
  }
});

router.get('/api/treasury/info', hybridAuth, async (req: Request, res: Response) => {
  try {
    const treasuryAddress = await getTreasuryAddress();
    const treasuryBalance = await getTreasuryBalance();

    return res.json({
      address: treasuryAddress,
      balance: treasuryBalance,
    });
  } catch (error: any) {
    console.error('Treasury info error:', error);
    return res.status(500).json({ error: 'Failed to fetch treasury info' });
  }
});

export default router;
