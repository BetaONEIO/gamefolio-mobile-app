import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { db } from '../db';
import { users, previousAvatars } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { maxUint256, parseUnits, type Address, decodeEventLog } from 'viem';
import {
  GF_TOKEN_ADDRESS,
  GF_TOKEN_ABI,
  MINT_SALE_ADDRESS,
  MINT_SALE_ABI,
  MINT_CONFIG,
  NFT_ABI,
  NFT_CONTRACT_ADDRESS,
} from '../../shared/contracts';
import { encryptPrivateKey } from '../wallet-crypto';
import { writeContractWithPoW, writeContractWithPoWFromRawKey, publicClient } from '../skale-pow';

const router = Router();

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_nfts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_id INTEGER NOT NULL,
        tx_hash VARCHAR(255),
        sold BOOLEAN DEFAULT FALSE,
        sold_at TIMESTAMP,
        minted_at TIMESTAMP DEFAULT NOW(),
        listed_price INTEGER DEFAULT 250,
        listing_active BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, token_id)
      )
    `);
    console.log('✅ user_nfts table ready');

    const existingCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM user_nfts`);
    const count = Number((existingCount as any)[0]?.cnt || 0);
    if (count === 0) {
      console.log('🔄 No NFT records found, running backfill...');
      const allUsersResult = await db.execute(
        sql`SELECT id, wallet_address FROM users WHERE wallet_address IS NOT NULL`
      );
      const userRows = (allUsersResult as any) || [];
      let totalBackfilled = 0;

      for (const u of userRows) {
        if (!u.wallet_address) continue;
        try {
          const balanceResult = await publicClient.readContract({
            address: NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: NFT_ABI,
            functionName: 'balanceOf',
            args: [u.wallet_address as `0x${string}`],
          });
          const balance = Number(balanceResult);
          if (balance === 0) continue;

          const currentBlock = await publicClient.getBlockNumber();
          const allTokenIds: number[] = [];
          const CHUNK = 2000;

          for (let i = 0; i < 100 && allTokenIds.length < balance; i++) {
            const toBlock = Number(currentBlock) - (i * CHUNK);
            const fromBlock = Math.max(0, toBlock - CHUNK + 1);
            try {
              const logs = await publicClient.getLogs({
                address: NFT_CONTRACT_ADDRESS as `0x${string}`,
                event: {
                  type: 'event' as const,
                  name: 'Transfer',
                  inputs: [
                    { indexed: true, name: 'from', type: 'address' },
                    { indexed: true, name: 'to', type: 'address' },
                    { indexed: true, name: 'tokenId', type: 'uint256' },
                  ],
                },
                args: { to: u.wallet_address as `0x${string}` },
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
              });
              for (const log of logs) {
                const tokenId = Number((log as any).args.tokenId);
                if (!allTokenIds.includes(tokenId)) allTokenIds.push(tokenId);
              }
            } catch { continue; }
            if (fromBlock === 0) break;
          }

          for (const tokenId of allTokenIds) {
            await db.execute(
              sql`INSERT INTO user_nfts (user_id, token_id, tx_hash) VALUES (${u.id}, ${tokenId}, ${'backfill'}) ON CONFLICT (user_id, token_id) DO NOTHING`
            );
          }
          if (allTokenIds.length > 0) {
            console.log(`✅ Backfilled ${allTokenIds.length} NFTs for user ${u.id}`);
            totalBackfilled += allTokenIds.length;
          }
        } catch (err) {
          console.error(`Backfill error for user ${u.id}:`, err);
        }
      }
      console.log(`✅ NFT backfill complete: ${totalBackfilled} total records`);
    }
  } catch (err) {
    console.error('Failed to create user_nfts table:', err);
  }
})();

router.get('/api/mint/wallet-status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      hasWallet: !!user.walletAddress,
      hasSigningKey: !!user.encryptedPrivateKey,
      walletAddress: user.walletAddress,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to check wallet status' });
  }
});

router.post('/api/mint/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.encryptedPrivateKey) {
      return res.status(400).json({
        error: 'No signing key available',
        code: 'MISSING_PRIVATE_KEY',
        message: 'Your wallet does not have a signing key. Please regenerate your wallet.',
      });
    }

    const hash = await writeContractWithPoW({
      encryptedPrivateKey: user.encryptedPrivateKey,
      contractAddress: GF_TOKEN_ADDRESS as Address,
      abi: GF_TOKEN_ABI,
      functionName: 'approve',
      args: [MINT_SALE_ADDRESS as Address, maxUint256],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Approval transaction reverted', txHash: hash });
    }

    return res.json({ success: true, txHash: hash });
  } catch (error: any) {
    console.error('Server-side approve error:', error);
    return res.status(500).json({ error: error.message || 'Approval failed' });
  }
});

router.post('/api/mint/mint', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { quantity } = req.body;
    if (!quantity || quantity < 1 || quantity > MINT_CONFIG.maxPerTx) {
      return res.status(400).json({
        error: `Quantity must be between 1 and ${MINT_CONFIG.maxPerTx}`,
      });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.walletAddress) {
      return res.status(400).json({
        error: 'No wallet available',
        message: 'Please create a wallet first.',
      });
    }

    if (!user.encryptedPrivateKey) {
      return res.status(400).json({
        error: 'No signing key available',
        code: 'MISSING_PRIVATE_KEY',
        message: 'Your wallet does not have a signing key. Please regenerate your wallet.',
      });
    }

    const totalCost = quantity * MINT_CONFIG.pricePerMint;
    const costInWei = parseUnits(String(totalCost), 18);
    const userAddress = user.walletAddress as Address;

    const onChainBalance = await publicClient.readContract({
      address: GF_TOKEN_ADDRESS as Address,
      abi: GF_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;

    const { formatUnits } = await import('viem');
    const readableBalance = formatUnits(onChainBalance, 18);

    if (onChainBalance < costInWei) {
      return res.status(400).json({
        error: `Insufficient on-chain GFT balance. Need ${totalCost} GFT but you have ${readableBalance} GFT.`,
      });
    }

    console.log(`🪙 Minting ${quantity} NFT(s) for user ${userId} (${userAddress}). Cost: ${totalCost} GFT. On-chain balance: ${readableBalance}`);

    const allowance = await publicClient.readContract({
      address: GF_TOKEN_ADDRESS as Address,
      abi: GF_TOKEN_ABI,
      functionName: 'allowance',
      args: [userAddress, MINT_SALE_ADDRESS as Address],
    }) as bigint;

    if (allowance < costInWei) {
      console.log(`🔓 Approving MintSale to spend GFT for user ${userId}`);
      const approveHash = await writeContractWithPoW({
        encryptedPrivateKey: user.encryptedPrivateKey,
        contractAddress: GF_TOKEN_ADDRESS as Address,
        abi: GF_TOKEN_ABI,
        functionName: 'approve',
        args: [MINT_SALE_ADDRESS as Address, maxUint256],
      });
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });
      if (approveReceipt.status !== 'success') {
        return res.status(400).json({ error: 'Approval transaction reverted', txHash: approveHash });
      }
      console.log(`✅ Approved MintSale. TX: ${approveHash}`);
    }

    console.log(`🛒 Calling buy(${quantity}) from user wallet`);
    const hash = await writeContractWithPoW({
      encryptedPrivateKey: user.encryptedPrivateKey,
      contractAddress: MINT_SALE_ADDRESS as Address,
      abi: MINT_SALE_ABI,
      functionName: 'buy',
      args: [BigInt(quantity)],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Mint transaction reverted', txHash: hash });
    }

    console.log(`✅ NFT minted successfully. On-chain GFT was spent via MintSale contract.`);

    try {
      await db.update(users)
        .set({ gfTokenBalance: sql`${users.gfTokenBalance} - ${totalCost}` })
        .where(eq(users.id, userId));
      console.log(`✅ Deducted ${totalCost} GFT from in-app balance for user ${userId}`);
    } catch (balanceErr) {
      console.error('Failed to deduct GFT balance after mint:', balanceErr);
    }

    const tokenIds: number[] = [];
    for (const log of receipt.logs) {
      try {
        if (log.address.toLowerCase() !== NFT_CONTRACT_ADDRESS.toLowerCase()) continue;
        const decoded = decodeEventLog({
          abi: [
            {
              anonymous: false,
              inputs: [
                { indexed: true, name: 'from', type: 'address' },
                { indexed: true, name: 'to', type: 'address' },
                { indexed: true, name: 'tokenId', type: 'uint256' },
              ],
              name: 'Transfer',
              type: 'event',
            },
          ],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'Transfer') {
          tokenIds.push(Number((decoded.args as any).tokenId));
        }
      } catch {
        continue;
      }
    }

    if (tokenIds.length > 0) {
      try {
        for (const tokenId of tokenIds) {
          await db.execute(
            sql`INSERT INTO user_nfts (user_id, token_id, tx_hash) VALUES (${userId}, ${tokenId}, ${hash}) ON CONFLICT (user_id, token_id) DO NOTHING`
          );
        }
        console.log(`✅ Recorded ${tokenIds.length} NFT(s) for user ${userId}: [${tokenIds.join(', ')}]`);
      } catch (dbErr) {
        console.error('Failed to save minted NFTs to database:', dbErr);
      }
    }

    return res.json({ success: true, txHash: hash, tokenIds });
  } catch (error: any) {
    console.error('Server-side mint error:', error);
    return res.status(500).json({ error: error.message || 'Mint failed' });
  }
});

router.post('/api/mint/regenerate-wallet', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { ethers } = await import('ethers');
    const wallet = ethers.Wallet.createRandom();
    const newAddress = wallet.address.toLowerCase();

    await db
      .update(users)
      .set({
        walletAddress: newAddress,
        walletChain: 'skale-nebula-testnet',
        walletCreatedAt: new Date(),
        encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
      })
      .where(eq(users.id, userId));

    console.log(`Wallet regenerated for user ${userId}: ${newAddress}`);

    return res.json({
      success: true,
      address: newAddress,
      message: 'Wallet regenerated successfully',
    });
  } catch (error: any) {
    console.error('Wallet regeneration error:', error);
    return res.status(500).json({ error: error.message || 'Wallet regeneration failed' });
  }
});

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://nftstorage.link/ipfs/',
];

function ipfsToHttp(ipfsUri: string, gatewayIndex = 0): string {
  if (!ipfsUri.startsWith('ipfs://')) return ipfsUri;
  const path = ipfsUri.replace('ipfs://', '');
  return `${IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length]}${path}`;
}

function ipfsToProxyUrl(ipfsUri: string): string {
  if (!ipfsUri.startsWith('ipfs://')) return ipfsUri;
  const path = ipfsUri.replace('ipfs://', '');
  return `/api/nft/image/${path}`;
}

router.get('/api/nft/image/:cid/*', async (req: Request, res: Response) => {
  try {
    const cid = req.params.cid;
    const rest = req.params[0] || '';
    const ipfsPath = rest ? `${cid}/${rest}` : cid;

    for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
      try {
        const url = `${IPFS_GATEWAYS[i]}${ipfsPath}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (response.ok && response.body) {
          const contentType = response.headers.get('content-type') || 'image/png';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
          const buffer = Buffer.from(await response.arrayBuffer());
          return res.send(buffer);
        }
      } catch {
        continue;
      }
    }
    return res.status(502).json({ error: 'Failed to fetch image from IPFS' });
  } catch (error: any) {
    console.error('IPFS image proxy error:', error);
    return res.status(500).json({ error: 'Image proxy error' });
  }
});

const nftThumbnailCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const NFT_THUMB_CACHE_TTL = 3600000;

router.get('/api/nft/thumb/:cid/*', async (req: Request, res: Response) => {
  try {
    const cid = req.params.cid;
    const rest = req.params[0] || '';
    const ipfsPath = rest ? `${cid}/${rest}` : cid;
    const size = parseInt(req.query.s as string) || 128;
    const clampedSize = Math.min(Math.max(size, 32), 512);
    const fmt = req.query.fmt as string;
    const cacheKey = `${ipfsPath}_${clampedSize}`;

    const cached = nftThumbnailCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < NFT_THUMB_CACHE_TTL) {
      if (fmt === 'dataurl') {
        const dataUrl = `data:image/png;base64,${cached.buffer.toString('base64')}`;
        return res.json({ dataUrl });
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(cached.buffer);
    }

    for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
      try {
        const url = `${IPFS_GATEWAYS[i]}${ipfsPath}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (response.ok && response.body) {
          const rawBuffer = Buffer.from(await response.arrayBuffer());
          const thumbnail = await sharp(rawBuffer)
            .resize(clampedSize, clampedSize, { fit: 'cover' })
            .png({ quality: 90 })
            .toBuffer();
          
          nftThumbnailCache.set(cacheKey, { buffer: thumbnail, timestamp: Date.now() });
          
          if (fmt === 'dataurl') {
            const dataUrl = `data:image/png;base64,${thumbnail.toString('base64')}`;
            return res.json({ dataUrl });
          }
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
          return res.send(thumbnail);
        }
      } catch {
        continue;
      }
    }
    return res.status(502).json({ error: 'Failed to fetch image from IPFS' });
  } catch (error: any) {
    console.error('IPFS thumbnail proxy error:', error);
    return res.status(500).json({ error: 'Thumbnail proxy error' });
  }
});

router.get('/api/nft/test-render', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head><title>NFT Test</title></head>
<body style="background:#222;color:#fff;padding:20px;font-family:sans-serif">
<h2>NFT Image Rendering Test</h2>
<p>Token 68 (mod_tom) - Direct img src:</p>
<div style="display:flex;gap:20px;align-items:center">
  <div style="width:96px;height:96px;background:black;border:2px solid red">
    <img src="/api/nft/thumb/bafybeihcjav5e6ivjqolmja3wwtbmajf743bmn3larf354edzrr25g7lym/68.png?s=96" 
         style="width:100%;height:100%;object-fit:cover" 
         onerror="this.nextElementSibling.textContent='FAILED'" />
    <span></span>
  </div>
  <div style="width:48px;height:48px;background:black;border:2px solid blue">
    <img src="/api/nft/thumb/bafybeihcjav5e6ivjqolmja3wwtbmajf743bmn3larf354edzrr25g7lym/68.png?s=64" 
         style="width:100%;height:100%;object-fit:cover" />
  </div>
  <div style="width:200px;height:200px;background:black;border:2px solid green">
    <img src="/api/nft/thumb/bafybeihcjav5e6ivjqolmja3wwtbmajf743bmn3larf354edzrr25g7lym/68.png?s=256" 
         style="width:100%;height:100%;object-fit:cover" />
  </div>
</div>
<p style="margin-top:20px">Token 73 (Player1):</p>
<div style="display:flex;gap:20px;align-items:center">
  <div style="width:96px;height:96px;background:black;border:2px solid red">
    <img src="/api/nft/thumb/bafybeihcjav5e6ivjqolmja3wwtbmajf743bmn3larf354edzrr25g7lym/73.png?s=96" 
         style="width:100%;height:100%;object-fit:cover" />
  </div>
</div>
<p style="margin-top:20px">Original full-size image (direct IPFS proxy):</p>
<div style="width:200px;height:200px;background:black;border:2px solid yellow">
  <img src="/api/nft/image/bafybeihcjav5e6ivjqolmja3wwtbmajf743bmn3larf354edzrr25g7lym/68.png" 
       style="width:100%;height:100%;object-fit:cover" />
</div>
</body></html>`);
});

router.get('/api/nft/metadata/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId) || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenURI = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    });

    const metadataUrl = ipfsToHttp(tokenURI as string) + '.json';

    let metadata: any = null;
    for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
      try {
        const url = ipfsToHttp(tokenURI as string, i) + '.json';
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          metadata = await response.json();
          break;
        }
      } catch {
        continue;
      }
    }

    if (!metadata) {
      return res.status(502).json({ error: 'Failed to fetch metadata from IPFS' });
    }

    if (metadata.image) {
      metadata.image = ipfsToProxyUrl(metadata.image);
    }

    return res.json({
      tokenId,
      tokenURI,
      ...metadata,
    });
  } catch (error: any) {
    console.error('NFT metadata fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch metadata' });
  }
});

router.post('/api/nft/metadata/batch', async (req: Request, res: Response) => {
  try {
    const { tokenIds } = req.body;
    if (!Array.isArray(tokenIds) || tokenIds.length === 0 || tokenIds.length > 20) {
      return res.status(400).json({ error: 'Provide 1-20 token IDs' });
    }

    const results = await Promise.allSettled(
      tokenIds.map(async (tokenId: number) => {
        const tokenURI = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)],
        });

        for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
          try {
            const url = ipfsToHttp(tokenURI as string, i) + '.json';
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (response.ok) {
              const metadata = await response.json();
              if (metadata.image) {
                metadata.image = ipfsToProxyUrl(metadata.image);
              }
              return { tokenId, ...metadata };
            }
          } catch {
            continue;
          }
        }
        return { tokenId, name: `Gamefolio Genesis #${tokenId}`, image: null };
      })
    );

    const nfts = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { tokenId: null, error: 'Failed' }
    );

    return res.json({ nfts });
  } catch (error: any) {
    console.error('Batch metadata fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch metadata' });
  }
});

router.get('/api/nfts/owned', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dbNfts = await db.execute(
      sql`SELECT token_id, tx_hash, minted_at, sold, sold_at, listed_price, listing_active FROM user_nfts WHERE user_id = ${userId} ORDER BY minted_at DESC`
    );

    const rows = (dbNfts as any).rows || dbNfts;
    if (!rows || rows.length === 0) {
      return res.json({ nfts: [], count: 0 });
    }

    const rowMap = new Map<number, { txHash: string; mintedAt: string; sold: boolean; soldAt: string | null; listedPrice: number | null; listingActive: boolean }>();
    for (const r of rows) {
      rowMap.set(Number(r.token_id), {
        txHash: r.tx_hash,
        mintedAt: r.minted_at,
        sold: r.sold === true || r.sold === 't',
        soldAt: r.sold_at || null,
        listedPrice: r.listed_price ? Number(r.listed_price) : null,
        listingActive: r.listing_active === true || r.listing_active === 't',
      });
    }
    const ownedTokenIds = rows.map((r: any) => Number(r.token_id));

    const metadataResults = await Promise.allSettled(
      ownedTokenIds.slice(0, 50).map(async (tokenId: number) => {
        const dbRow = rowMap.get(tokenId);
        const tokenURI = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)],
        });

        for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
          try {
            const url = ipfsToHttp(tokenURI as string, i) + '.json';
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (response.ok) {
              const metadata = await response.json();
              if (metadata.image) {
                metadata.image = ipfsToProxyUrl(metadata.image);
              }
              return {
                tokenId,
                txHash: dbRow?.txHash || '',
                mintedAt: dbRow?.mintedAt || '',
                sold: dbRow?.sold || false,
                soldAt: dbRow?.soldAt || null,
                listedPrice: dbRow?.listedPrice || null,
                listingActive: dbRow?.listingActive || false,
                ...metadata,
              };
            }
          } catch {
            continue;
          }
        }
        return {
          tokenId,
          name: `Gamefolio Genesis #${tokenId}`,
          image: null,
          txHash: dbRow?.txHash || '',
          mintedAt: dbRow?.mintedAt || '',
          sold: dbRow?.sold || false,
          soldAt: dbRow?.soldAt || null,
          listedPrice: dbRow?.listedPrice || null,
          listingActive: dbRow?.listingActive || false,
        };
      })
    );

    const nfts = metadataResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return res.json({ nfts, count: ownedTokenIds.length });
  } catch (error: any) {
    console.error('Owned NFTs fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch owned NFTs' });
  }
});

router.get('/api/nfts/user/:userId', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const dbNfts = await db.execute(
      sql`SELECT token_id, tx_hash, minted_at, sold, sold_at, listed_price, listing_active FROM user_nfts WHERE user_id = ${targetUserId} AND sold = false ORDER BY minted_at DESC`
    );

    const rows = (dbNfts as any).rows || dbNfts;
    if (!rows || rows.length === 0) {
      return res.json({ nfts: [], count: 0 });
    }

    const rowMap = new Map<number, { txHash: string; mintedAt: string; listedPrice: number | null; listingActive: boolean }>();
    for (const r of rows) {
      rowMap.set(Number(r.token_id), {
        txHash: r.tx_hash,
        mintedAt: r.minted_at,
        listedPrice: r.listed_price ? Number(r.listed_price) : null,
        listingActive: r.listing_active === true || r.listing_active === 't',
      });
    }
    const ownedTokenIds = rows.map((r: any) => Number(r.token_id));

    const metadataResults = await Promise.allSettled(
      ownedTokenIds.slice(0, 50).map(async (tokenId: number) => {
        const dbRow = rowMap.get(tokenId);
        const tokenURI = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)],
        });

        for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
          try {
            const url = ipfsToHttp(tokenURI as string, i) + '.json';
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (response.ok) {
              const metadata = await response.json();
              if (metadata.image) {
                metadata.image = ipfsToProxyUrl(metadata.image);
              }
              return {
                tokenId,
                name: metadata.name || `Gamefolio Genesis #${tokenId}`,
                image: metadata.image || null,
                attributes: metadata.attributes || [],
                mintedAt: dbRow?.mintedAt || '',
                listedPrice: dbRow?.listedPrice || null,
                listingActive: dbRow?.listingActive || false,
              };
            }
          } catch {
            continue;
          }
        }
        return {
          tokenId,
          name: `Gamefolio Genesis #${tokenId}`,
          image: null,
          attributes: [],
          mintedAt: dbRow?.mintedAt || '',
          listedPrice: dbRow?.listedPrice || null,
          listingActive: dbRow?.listingActive || false,
        };
      })
    );

    const nfts = metadataResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return res.json({ nfts, count: ownedTokenIds.length });
  } catch (error: any) {
    console.error('User NFTs fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user NFTs' });
  }
});

router.post('/api/admin/nfts/backfill', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const allUsers = await db.execute(
      sql`SELECT id, wallet_address FROM users WHERE wallet_address IS NOT NULL`
    );
    const userRows = (allUsers as any).rows || allUsers;
    let totalBackfilled = 0;

    for (const u of userRows) {
      const walletAddress = u.wallet_address;
      if (!walletAddress) continue;

      try {
        const balanceResult = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        });
        const balance = Number(balanceResult);
        if (balance === 0) continue;

        const currentBlock = await publicClient.getBlockNumber();
        const allTokenIds: number[] = [];
        const CHUNK = 2000;

        for (let i = 0; i < 100 && allTokenIds.length < balance; i++) {
          const toBlock = Number(currentBlock) - (i * CHUNK);
          const fromBlock = Math.max(0, toBlock - CHUNK + 1);

          try {
            const logs = await publicClient.getLogs({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              event: {
                type: 'event' as const,
                name: 'Transfer',
                inputs: [
                  { indexed: true, name: 'from', type: 'address' },
                  { indexed: true, name: 'to', type: 'address' },
                  { indexed: true, name: 'tokenId', type: 'uint256' },
                ],
              },
              args: { to: walletAddress as `0x${string}` },
              fromBlock: BigInt(fromBlock),
              toBlock: BigInt(toBlock),
            });

            for (const log of logs) {
              const tokenId = Number((log as any).args.tokenId);
              if (!allTokenIds.includes(tokenId)) {
                allTokenIds.push(tokenId);
              }
            }
          } catch {
            continue;
          }

          if (fromBlock === 0) break;
        }

        for (const tokenId of allTokenIds) {
          await db.execute(
            sql`INSERT INTO user_nfts (user_id, token_id, tx_hash) VALUES (${u.id}, ${tokenId}, ${'backfill'}) ON CONFLICT (user_id, token_id) DO NOTHING`
          );
          totalBackfilled++;
        }
      } catch (err) {
        console.error(`Backfill error for user ${u.id}:`, err);
      }
    }

    return res.json({ success: true, totalBackfilled });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return res.status(500).json({ error: error.message || 'Backfill failed' });
  }
});

router.post('/api/nft/set-profile-picture', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { tokenId, imageUrl } = req.body;

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (tokenId === null || tokenId === undefined) {
      await db.update(users).set({
        activeProfilePicType: 'upload',
      }).where(eq(users.id, userId));
      return res.json({ success: true, cleared: true, restoredAvatarUrl: currentUser.avatarUrl });
    }

    if (typeof tokenId !== 'number' || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const nftCheck = await db.execute(
      sql`SELECT id FROM user_nfts WHERE user_id = ${userId} AND token_id = ${tokenId} AND (sold = false OR sold IS NULL)`
    );
    const nftRows = (nftCheck as any).rows || nftCheck;
    if (!nftRows || nftRows.length === 0) {
      return res.status(403).json({ error: 'You do not own this NFT or it has been sold' });
    }

    await db.update(users).set({
      nftProfileTokenId: tokenId,
      nftProfileImageUrl: imageUrl || null,
      activeProfilePicType: 'nft',
    }).where(eq(users.id, userId));

    return res.json({ success: true, tokenId, imageUrl });
  } catch (error: any) {
    console.error('Set NFT profile picture error:', error);
    return res.status(500).json({ error: error.message || 'Failed to set NFT profile picture' });
  }
});

router.get('/api/nft/profile-picture/:userId', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const [user] = await db.select({
      nftProfileTokenId: users.nftProfileTokenId,
      nftProfileImageUrl: users.nftProfileImageUrl,
    }).from(users).where(eq(users.id, targetUserId)).limit(1);

    if (!user || !user.nftProfileTokenId) {
      return res.json({ hasNftProfile: false });
    }

    let metadata = null;
    try {
      const tokenURI = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'tokenURI',
        args: [BigInt(user.nftProfileTokenId)],
      });

      for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
        try {
          const url = ipfsToHttp(tokenURI as string, i) + '.json';
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (response.ok) {
            metadata = await response.json();
            if (metadata.image) {
              metadata.image = ipfsToProxyUrl(metadata.image);
            }
            break;
          }
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.error('Failed to fetch NFT metadata for profile:', err);
    }

    return res.json({
      hasNftProfile: true,
      tokenId: user.nftProfileTokenId,
      imageUrl: user.nftProfileImageUrl,
      metadata,
    });
  } catch (error: any) {
    console.error('Get NFT profile picture error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get NFT profile picture' });
  }
});

export default router;
