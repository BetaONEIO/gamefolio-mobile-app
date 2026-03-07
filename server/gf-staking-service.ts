import { createPublicClient, http, formatUnits, type Address, type PublicClient } from 'viem';
import { GF_STAKING_ADDRESS, GF_STAKING_ABI, SKALE_NEBULA_TESTNET } from '@shared/contracts';

const GF_DECIMALS = 18;

export class StakingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StakingError';
  }
}

function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: SKALE_NEBULA_TESTNET as any,
    transport: http(SKALE_NEBULA_TESTNET.rpcUrls.default.http[0]),
  });
}

export interface StakePosition {
  staked: string;
  earned: string;
  stakedRaw: bigint;
  earnedRaw: bigint;
}

export async function getStakePosition(address: string): Promise<StakePosition> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new StakingError('Invalid wallet address format', 'INVALID_ADDRESS');
  }

  const client = getPublicClient();
  const userAddress = address as Address;

  try {
    const [stakesResult, pendingRewardsRaw] = await Promise.all([
      client.readContract({
        address: GF_STAKING_ADDRESS,
        abi: GF_STAKING_ABI,
        functionName: 'stakes',
        args: [userAddress],
      }) as Promise<readonly [bigint, bigint, bigint]>,
      client.readContract({
        address: GF_STAKING_ADDRESS,
        abi: GF_STAKING_ABI,
        functionName: 'pendingRewards',
        args: [userAddress],
      }) as Promise<bigint>,
    ]);

    const stakedRaw = stakesResult[0];

    return {
      staked: formatUnits(stakedRaw, GF_DECIMALS),
      earned: formatUnits(pendingRewardsRaw, GF_DECIMALS),
      stakedRaw,
      earnedRaw: pendingRewardsRaw,
    };
  } catch (error: any) {
    throw new StakingError(`Failed to get stake position: ${error.message}`, 'READ_ERROR');
  }
}

export async function getStakingStats(): Promise<{
  totalStaked: string;
  rewardRate: string;
}> {
  const client = getPublicClient();

  try {
    const [totalStakedRaw, rewardRateRaw] = await Promise.all([
      client.readContract({
        address: GF_STAKING_ADDRESS,
        abi: GF_STAKING_ABI,
        functionName: 'totalStaked',
        args: [],
      }) as Promise<bigint>,
      client.readContract({
        address: GF_STAKING_ADDRESS,
        abi: GF_STAKING_ABI,
        functionName: 'rewardRate',
        args: [],
      }) as Promise<bigint>,
    ]);

    return {
      totalStaked: formatUnits(totalStakedRaw, GF_DECIMALS),
      rewardRate: formatUnits(rewardRateRaw, GF_DECIMALS),
    };
  } catch (error: any) {
    throw new StakingError(`Failed to get staking stats: ${error.message}`, 'STATS_ERROR');
  }
}
