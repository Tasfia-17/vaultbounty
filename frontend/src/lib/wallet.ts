import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { CHAIN_ID, RPC_URL } from "./constants.js";

export const aeneid = {
  id: CHAIN_ID,
  name: "Story Aeneid Testnet",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "StoryScan", url: "https://aeneid.storyscan.io" } },
};

export const publicClient = createPublicClient({ chain: aeneid as any, transport: http(RPC_URL) });

export function getWalletClient() {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask.");
  return createWalletClient({ chain: aeneid as any, transport: custom(window.ethereum) });
}

export async function connectWallet(): Promise<Address> {
  const wc = getWalletClient();
  const [address] = await wc.requestAddresses();
  const eth = window.ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask.");
  // Switch to Aeneid if needed
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (e: any) {
    if (e.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: `0x${CHAIN_ID.toString(16)}`,
          chainName: "Story Aeneid Testnet",
          nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ["https://aeneid.storyscan.io"],
        }],
      });
    }
  }
  return address;
}
