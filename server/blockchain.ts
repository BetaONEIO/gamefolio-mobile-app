import { createPublicClient, http, formatUnits, Address } from 'viem';
import { GF_TOKEN_ADDRESS, GF_TOKEN_ABI, SKALE_NEBULA_TESTNET } from '../shared/contracts';

const publicClient = createPublicClient({
  chain: SKALE_NEBULA_TESTNET,
  transport: http(),
});

export async function getTokenBalance(walletAddress: string): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: GF_TOKEN_ADDRESS,
      abi: GF_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as Address],
    });

    return formatUnits(balance as bigint, 18);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    throw error;
  }
}

export async function getTokenInfo() {
  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: GF_TOKEN_ADDRESS,
        abi: GF_TOKEN_ABI,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: GF_TOKEN_ADDRESS,
        abi: GF_TOKEN_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: GF_TOKEN_ADDRESS,
        abi: GF_TOKEN_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: GF_TOKEN_ADDRESS,
        abi: GF_TOKEN_ABI,
        functionName: 'totalSupply',
      }),
    ]);

    return {
      name: name as string,
      symbol: symbol as string,
      decimals: decimals as number,
      totalSupply: formatUnits(totalSupply as bigint, decimals as number),
      contractAddress: GF_TOKEN_ADDRESS,
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    throw error;
  }
}
