import { createPublicClient, http, encodeFunctionData, getAddress, type Address, type Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SKALE_NEBULA_TESTNET } from '../shared/contracts';

const RPC_URL = SKALE_NEBULA_TESTNET.rpcUrls.default.http[0];

const publicClient = createPublicClient({
  chain: SKALE_NEBULA_TESTNET,
  transport: http(RPC_URL),
});

export async function writeContractWithPoW({
  encryptedPrivateKey,
  contractAddress,
  abi,
  functionName,
  args,
}: {
  encryptedPrivateKey: string;
  contractAddress: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): Promise<`0x${string}`> {
  const { decryptPrivateKey } = await import('./wallet-crypto');
  const { mineGasForTransactionAsync } = await import('@eidolon-labs/gasless');

  const privateKey = decryptPrivateKey(encryptedPrivateKey);
  const formattedKey = privateKey.startsWith('0x')
    ? (privateKey as `0x${string}`)
    : (`0x${privateKey}` as `0x${string}`);
  const account = privateKeyToAccount(formattedKey);
  const checksumAddress = getAddress(account.address);

  const data = encodeFunctionData({
    abi: abi as Abi,
    functionName,
    args: args as unknown[],
  });

  const nonce = await publicClient.getTransactionCount({ address: checksumAddress });

  let gasLimit: number;
  try {
    const gasEstimate = await publicClient.estimateGas({
      account: checksumAddress,
      to: contractAddress,
      data,
    });
    gasLimit = Number(gasEstimate) + 50000;
  } catch {
    gasLimit = 300000;
  }

  const { gasPrice: magicGasPrice } = await mineGasForTransactionAsync(
    gasLimit,
    checksumAddress,
    nonce,
  );

  const signedTx = await account.signTransaction({
    to: contractAddress,
    data,
    nonce,
    gasPrice: BigInt(magicGasPrice),
    gas: BigInt(gasLimit),
    chainId: SKALE_NEBULA_TESTNET.id,
    type: 'legacy' as const,
  });

  const hash = await publicClient.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  return hash;
}

export async function writeContractWithPoWFromRawKey({
  privateKeyRaw,
  contractAddress,
  abi,
  functionName,
  args,
}: {
  privateKeyRaw: string;
  contractAddress: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): Promise<`0x${string}`> {
  const { mineGasForTransactionAsync } = await import('@eidolon-labs/gasless');

  const formattedKey = privateKeyRaw.startsWith('0x')
    ? (privateKeyRaw as `0x${string}`)
    : (`0x${privateKeyRaw}` as `0x${string}`);
  const account = privateKeyToAccount(formattedKey);
  const checksumAddress = getAddress(account.address);

  const data = encodeFunctionData({
    abi: abi as Abi,
    functionName,
    args: args as unknown[],
  });

  const nonce = await publicClient.getTransactionCount({ address: checksumAddress });

  let gasLimit: number;
  try {
    const gasEstimate = await publicClient.estimateGas({
      account: checksumAddress,
      to: contractAddress,
      data,
    });
    gasLimit = Number(gasEstimate) + 50000;
  } catch {
    gasLimit = 300000;
  }

  const { gasPrice: magicGasPrice } = await mineGasForTransactionAsync(
    gasLimit,
    checksumAddress,
    nonce,
  );

  const signedTx = await account.signTransaction({
    to: contractAddress,
    data,
    nonce,
    gasPrice: BigInt(magicGasPrice),
    gas: BigInt(gasLimit),
    chainId: SKALE_NEBULA_TESTNET.id,
    type: 'legacy' as const,
  });

  const hash = await publicClient.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  return hash;
}

export { publicClient };
