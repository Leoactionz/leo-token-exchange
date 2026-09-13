require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const privateKeys = process.env.PRIVATE_KEYS || ""

// Prefer an explicit SEPOLIA_RPC_URL, then Infura, then a keyless public node.
// Guarding on INFURA_API_KEY avoids building ".../v3/undefined", which Infura
// rejects with a 429 that looks like rate limiting.
const sepoliaRpcUrl =
  process.env.SEPOLIA_RPC_URL ||
  (process.env.INFURA_API_KEY
    ? "https://sepolia.infura.io/v3/" + process.env.INFURA_API_KEY
    : "https://ethereum-sepolia-rpc.publicnode.com");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 7545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
    },
    sepolia: {
      provider: () => new HDWalletProvider({
        privateKeys: privateKeys.split(","), // Array of account private keys
        providerOrUrl: sepoliaRpcUrl,
        chainId: 11155111, // Signs with EIP-155 replay protection
        pollingInterval: 30000, // hdwallet-provider defaults to 4s; a single 429'd poll kills the run
      }),
      gas: 5000000,
      network_id: 11155111,
      networkCheckTimeout: 120000, // Default 5s is far too tight for a throttled endpoint
      deploymentPollingInterval: 20000, // Default 4s; this is what polls for receipts
      timeoutBlocks: 200,
      confirmations: 0,
      skipDryRun: true, // A dry run roughly doubles the request count
    },
  },
  contracts_directory: "./src/contracts",
  contracts_build_directory: "./src/abis",

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
