import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { StoryClient } from "@story-protocol/core-sdk";

// ── Story Aeneid testnet ──────────────────────────────────────────────────────
export const RPC_URL = process.env.RPC_URL    ?? "https://aeneid.storyrpc.io";
export const API_URL = process.env.API_URL    ?? "http://172.192.41.96:1317";

// ── Deployed contract addresses ───────────────────────────────────────────────
export const CONTRACTS = {
  BOUNTY_REGISTRY:              process.env.BOUNTY_REGISTRY_ADDRESS!             as `0x${string}`,
  BOUNTY_READ_CONDITION:        process.env.BOUNTY_READ_CONDITION_ADDRESS!        as `0x${string}`,
  RESEARCHER_WRITE_CONDITION:   process.env.RESEARCHER_WRITE_CONDITION_ADDRESS!   as `0x${string}`,
  MOCK_TEE_VERIFIER:            process.env.MOCK_TEE_VERIFIER_ADDRESS!            as `0x${string}`,
  VULNERABLE_VAULT:             process.env.VULNERABLE_VAULT_ADDRESS!             as `0x${string}`,
  // Story Protocol (Aeneid testnet — fixed addresses)
  IP_ASSET_REGISTRY:            "0x77319B4031e6eF1250907aa00018B8B1c67a244b" as `0x${string}`,
  LICENSING_MODULE:             "0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f" as `0x${string}`,
  PIL_TEMPLATE:                 "0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316" as `0x${string}`,
  ROYALTY_MODULE:               "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`,
  LICENSE_TOKEN:                "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
  WIP_TOKEN:                    "0x1514000000000000000000000000000000000000" as `0x${string}`,
  // CDR precompiles
  CDR:                          "0xCcCcCC0000000000000000000000000000000005" as `0x${string}`,
  DKG:                          "0xCcCcCC0000000000000000000000000000000004" as `0x${string}`,
};

// ── Client factory ────────────────────────────────────────────────────────────

function makeAccount(envKey: string): Account {
  const pk = process.env[envKey];
  if (!pk) throw new Error(`Missing env: ${envKey}`);
  return privateKeyToAccount(`0x${pk.replace(/^0x/, "")}`);
}

function makePublicClient(): PublicClient {
  return createPublicClient({ transport: http(RPC_URL) });
}

function makeWalletClient(account: Account): WalletClient {
  return createWalletClient({ account, transport: http(RPC_URL) });
}

function makeCDRClient(account: Account): CDRClient {
  return new CDRClient({
    network: "testnet",
    publicClient: makePublicClient(),
    walletClient: makeWalletClient(account),
    apiUrl: API_URL,
  });
}

export async function getResearcherClients() {
  await initWasm();
  const account = makeAccount("RESEARCHER_PRIVATE_KEY");
  return {
    account,
    publicClient: makePublicClient(),
    walletClient: makeWalletClient(account),
    cdrClient:    makeCDRClient(account),
    storyClient:  StoryClient.newClient({ transport: http(RPC_URL), account, chainId: "aeneid" }),
  };
}

export async function getCompanyClients() {
  await initWasm();
  const account = makeAccount("COMPANY_PRIVATE_KEY");
  return {
    account,
    publicClient: makePublicClient(),
    walletClient: makeWalletClient(account),
    cdrClient:    makeCDRClient(account),
  };
}

export async function getTeeRelayerClients() {
  const account = makeAccount("TEE_RELAYER_PRIVATE_KEY");
  return {
    account,
    publicClient: makePublicClient(),
    walletClient: makeWalletClient(account),
  };
}

export function getPublicClientOnly(): PublicClient {
  return makePublicClient();
}
