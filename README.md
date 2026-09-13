# LEO Token Exchange

LEO Token Exchange is a full-stack Web3 learning project that implements a small, order-book-based decentralized exchange on Ethereum. Users connect through MetaMask, deposit ETH or LEO tokens into the exchange contract, create buy and sell orders, fill or cancel orders, and view trading activity in the browser.

The application has no traditional backend. Smart contracts hold the assets and exchange state, blockchain events provide the order history, Redux prepares that data for the UI, and React renders the trading dashboard.

> **Important:** This project is intended for learning and demonstration. The contracts have not been professionally audited and should not be used with assets of real value.

## Features

- MetaMask wallet connection
- ETH and token deposits and withdrawals
- Buy and sell limit orders
- Order cancellation and fulfillment
- Exchange fees paid by the account filling an order
- Live order-book and transaction updates from contract events
- Personal open-order and trade history
- Historical trades and price chart
- Local Ganache and Ethereum Sepolia configurations
- Solidity tests for token and exchange behavior

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, React Bootstrap |
| State | Redux, Reselect |
| Blockchain client | Web3.js 1.x, MetaMask |
| Smart contracts | Solidity 0.8.x |
| Development | Truffle, Ganache |
| Charts | ApexCharts |
| Tests | Truffle, Mocha, Chai |

## How it works

1. MetaMask supplies the active Ethereum account and network.
2. The frontend reads deployed addresses from the Truffle artifacts in `src/abis`.
3. Users first deposit ETH or LEO into the `Exchange` contract.
4. A maker creates an order describing the asset they want and the asset they will give.
5. Another user fills the order using their deposited exchange balance.
6. The exchange updates its internal balances and credits the configured fee account.
7. `Order`, `Cancel`, `Trade`, `Deposit`, and `Withdraw` events update the Redux store and interface.

The contracts use the zero address (`0x0000000000000000000000000000000000000000`) as the internal identifier for ETH.

## Project structure

```text
my-web3app/
├── migrations/             Truffle deployment scripts
├── public/                 Static browser assets
├── scripts/
│   └── seed-exchange.js    Creates sample balances, orders, and trades
├── src/
│   ├── abis/               Generated contract artifacts and addresses
│   ├── components/         React exchange interface
│   ├── contracts/          Token and Exchange Solidity contracts
│   ├── store/              Redux actions, reducers, selectors, and Web3 calls
│   ├── helpers.jsx         Amount, address, and display helpers
│   └── main.jsx            Frontend entry point
├── test/                   Truffle contract tests
├── truffle-config.js       Local and Sepolia network configuration
└── vite.config.js          Frontend build configuration
```

## Prerequisites

Install the following before starting:

- [Node.js](https://nodejs.org/) `20.19+` or `22.12+`
- npm
- [Ganache](https://archive.trufflesuite.com/ganache/) for a local blockchain
- [MetaMask](https://metamask.io/) in your browser
- Git, if you are cloning the repository

The Vite version used by this project requires a newer Node.js release even though some older dependencies support Node 18.

## Local installation

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm ci
```

Replace the example URL and directory with your GitHub repository details. `npm ci` installs the exact dependency versions recorded in `package-lock.json`; use `npm install` only when intentionally updating dependencies.

### 2. Start Ganache

Start a Ganache workspace with this RPC configuration:

```text
RPC URL:    http://127.0.0.1:7545
Network ID: any value is accepted by Truffle
Chain ID:   use the value displayed by Ganache, commonly 1337
```

The RPC port must be `7545` unless you also change the `development` network in `truffle-config.js`.

Keep Ganache running for the remaining commands.

### 3. Compile and deploy the contracts

```bash
npx truffle compile
npx truffle migrate --reset --network development
```

This deploys:

- `Token`, with a supply of 1,000,000 LEO assigned to the deployer
- `Exchange`, with the first Ganache account as the fee account and a 10% fee

Truffle writes the compiled ABIs and deployed network addresses to `src/abis`. The frontend needs these generated files to locate the contracts.

### 4. Add Ganache to MetaMask

Create a custom MetaMask network using the Ganache RPC URL and chain ID shown above. Then import the private key for one of the Ganache accounts.

Only use Ganache-generated keys on a local development network. Never use or share a wallet that holds real assets.

### 5. Add sample exchange data (optional)

```bash
npx truffle exec scripts/seed-exchange.js --network development
```

The seed script distributes tokens, deposits test assets, and creates cancelled, filled, and open orders using the first two Ganache accounts. It is useful for populating the order book and price chart.

Run it once after a fresh deployment. Running it repeatedly creates additional sample transactions.

### 6. Start the frontend

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. Approve the MetaMask connection and make sure MetaMask is using the same Ganache network where the contracts were deployed.

## Recreating a fresh local deployment

Ganache blockchain data and Truffle deployment addresses must stay in sync. To recreate the project from a new Ganache workspace:

```bash
npm ci
npx truffle compile --all
npx truffle migrate --reset --network development
npx truffle exec scripts/seed-exchange.js --network development
npm run dev
```

After resetting Ganache, import an account from the new workspace into MetaMask and confirm that its chain ID matches the selected network.

## Running the contract tests

With Ganache running on port `7545`:

```bash
npx truffle test --network development
```

The tests cover token deployment and transfers, approvals, ETH/token deposits and withdrawals, order creation, cancellation, fulfillment, and fee accounting.

## Sepolia deployment

Create a local `.env` file in the project root:

```dotenv
# One or more comma-separated deployment account private keys
PRIVATE_KEYS=your_private_key

# Choose a custom Sepolia endpoint:
SEPOLIA_RPC_URL=https://your-sepolia-rpc-url

# Or use Infura instead of SEPOLIA_RPC_URL:
# INFURA_API_KEY=your_infura_project_key
```

If neither RPC setting is supplied, the configuration falls back to a public Sepolia endpoint. The deployment account must contain enough Sepolia ETH to pay gas.

Deploy with:

```bash
npx truffle migrate --reset --network sepolia
```

Then select Sepolia in MetaMask and run `npm run dev`. The migration updates the contract artifacts with the Sepolia addresses used by the frontend.

Do not run the seed script on Sepolia casually: it submits many transactions, expects at least two configured accounts, and consumes test ETH.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce the locked dependency installation |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production frontend build in `dist` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |
| `npx truffle compile` | Compile the Solidity contracts into `src/abis` |
| `npx truffle migrate --reset` | Redeploy the contracts |
| `npx truffle test` | Run the Solidity contract tests |

## Common problems

### “Smart contracts not detected on the current network”

- Confirm Ganache is running on port `7545`.
- Confirm the contracts were migrated after the current Ganache workspace was created.
- Select the correct Ganache network in MetaMask.
- Confirm `src/abis/Token.json` and `src/abis/Exchange.json` contain an entry for the current network ID.

### MetaMask does not show an account or connection request

- Install and unlock MetaMask.
- Refresh the page and approve the connection request.
- Import one of the current Ganache workspace accounts for local testing.

### A transaction fails with an insufficient balance

Wallet balances and exchange balances are separate. Deposit the asset into the exchange before creating or filling an order. An order filler also needs enough of the requested asset to cover the trade amount plus the exchange fee.

### The order book is empty

Run the seed script or create orders from the interface. Historical order-book data is reconstructed from contract events, so a newly deployed exchange starts empty.

### Ganache was restarted or reset

Redeploy the contracts with `npx truffle migrate --reset --network development`. A new workspace has new accounts and contract addresses, so update the MetaMask account and network if necessary.

## Security notes

- `.env` files, private keys, keystores, wallet exports, seed phrases, and credential files are excluded by `.gitignore`.
- Never commit private keys or recovery phrases, even for a testnet wallet.
- Never place secrets in frontend code; Vite bundles frontend source for browser users to inspect.
- Use a dedicated, low-value development wallet for Sepolia.
- Treat this codebase as educational until the smart contracts have received a complete security review.

## Current limitations

- The UI still labels the LEO token as `DAPP` in several places.
- Orders record intent but do not reserve a maker's deposited balance at creation time. A fill can therefore fail if that balance is spent or withdrawn later.
- The interface currently supports one configured token market against ETH.
- Contract history is loaded by scanning events from block `0`, which is not efficient for a large production deployment.
- There is no production indexer, backend, governance system, or formal contract audit.

## License

The Solidity source files declare the MIT license. Add a root `LICENSE` file before distributing the complete project under MIT terms.
