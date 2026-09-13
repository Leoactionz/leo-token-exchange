// Contracts
const Token = artifacts.require('Token');
const Exchange = artifacts.require('Exchange');

// Utils
const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';

const ether = (n) => {
  return web3.utils.toWei(n.toString(), 'ether');
};

const tokens = (n) => ether(n);
const wait = (seconds) => {
  const milliseconds = seconds * 1000;
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

module.exports = async function (callback) {
  try {
    console.log('Scripts running...');
    // Fetch accounts from wallet  - these are unlocked and can be used to send transactions
    const accounts = await web3.eth.getAccounts();

    // web3 polls eth_getTransactionReceipt every 1s by default. On Sepolia a tx
    // takes ~12s to mine, so that is ~12 polls per tx in a burst - enough to trip
    // Infura's per-second rate limit, and one throttled poll aborts the whole run.
    for (const w of [web3, Token.web3, Exchange.web3]) {
      if (w && w.eth) w.eth.transactionPollingInterval = 8000;
    }

    // Fetch the deployed token
    const token = await Token.deployed();
    console.log('Token fetched:', token.address);

    // Fetch the deployed exchange
    const exchange = await Exchange.deployed();
    console.log('Exchange fetched:', exchange.address);

    //     // Seed the exchange with some tokens and Ether for testing
    const sender = accounts[0];
    const receiver = accounts[1];
    let amount = web3.utils.toWei('1000', 'ether'); //10,000 tokens

    // Transfer some tokens to user1
    await token.transfer(receiver, amount, { from: sender });
    console.log(`Transferred ${amount} tokens from ${sender} to ${receiver}`);
    await wait(3);

    // Set up exchange users
    const user1 = accounts[0];
    const user2 = accounts[1];
    // User1 deposits some Ether into the exchange
    const etherDeposit = web3.utils.toWei('0.1', 'ether'); // 0.1 ETH for exchange operations
    await exchange.depositEther({
      from: user1,
      value: etherDeposit,
    });
    console.log(`Deposited ${etherDeposit} Ether (0.1 ETH) from ${user1}`);
    await wait(3);

    // User2 approves the exchange to spend their tokens
    amount = 10000;
    await token.approve(exchange.address, tokens(amount), {
      from: user2,
    });
    console.log(`Approved ${amount} tokens from ${user2}`);
    await wait(3);

    // User2 deposits Ether into the exchange to fill orders
    const etherDeposit2 = web3.utils.toWei('0.05', 'ether');
    await exchange.depositEther({
      from: user2,
      value: etherDeposit2,
    });
    console.log(`Deposited ${etherDeposit2} Ether (0.05 ETH) from ${user2}`);
    await wait(3);

    // User2 deposits tokens into the exchange
    await exchange.depositTokens(token.address, tokens(500), {
      from: user2,
    });
    console.log(`Deposited 500 tokens from ${user2}`);
    await wait(3);

    /////////////////////////////////////////////////////////
    // Seed a Cancelled Order
    /////////////////////////////////////////////////////////
    // User1 makes order to get tokens
    let result = await exchange.makeOrder(
      token.address,
      tokens(100),
      ETHER_ADDRESS,
      web3.utils.toWei('0.01', 'ether'),
      { from: user1 },
    );
    console.log('Made order');

    // User1 cancels the order
    const orderId = result.logs[0].args.id;
    await exchange.cancelOrder(orderId, { from: user1 });
    console.log('Cancelled order from ${user1}');

    /////////////////////////////////////////////////////////

    // Seed Filled Orders
    //

    // User1 makes order to get tokens
    result = await exchange.makeOrder(
      token.address,
      tokens(100),
      ETHER_ADDRESS,
      web3.utils.toWei('0.001', 'ether'),
      { from: user1 },
    );
    console.log('Made order from ${user1}');

    // User2 fills the order (use the NEW orderId, not the cancelled one)
    const filledOrderId = result.logs[0].args.id;
    await exchange.fillOrder(filledOrderId, { from: user2 });
    console.log('Filled order from ${user1}');

    // Wait 1 second
    await wait(1);

    // User1 makes another order to get tokens
    result = await exchange.makeOrder(
      token.address,
      tokens(50),
      ETHER_ADDRESS,
      web3.utils.toWei('0.0001', 'ether'),
      { from: user1 },
    );
    console.log('Made order from ${user1}');

    // User2 fills another order (use the NEW orderId)
    let currentOrderId = result.logs[0].args.id;
    await exchange.fillOrder(currentOrderId, { from: user2 });
    console.log('Filled order from ${user1}');

    // Wait 1 second
    await wait(1);

    // User1 makes final order
    result = await exchange.makeOrder(
      token.address,
      tokens(200),
      ETHER_ADDRESS,
      web3.utils.toWei('0.0015', 'ether'),
      { from: user1 },
    );
    console.log('Made order from ${user1}');

    // User2 fills final order (use the NEW orderId)
    currentOrderId = result.logs[0].args.id;
    await exchange.fillOrder(currentOrderId, { from: user2 });
    console.log('Filled order from ${user1}');

    // Wait 1 second
    await wait(1);

    /////////////////////////////////////////////////////
    // Seed Open Orders
    /////////////////////////////////////////////////////
    // User1 makes 10 orders
    for (let i = 1; i <= 3; i++) {
      result = await exchange.makeOrder(
        token.address,
        tokens(10 * i),
        ETHER_ADDRESS,
        web3.utils.toWei((0.0001 * i).toFixed(6), 'ether'),
        { from: user1 },
      );
      console.log(`Made order from ${user1}`);
      await wait(3);
    }

    // User2 makes 10 orders
    for (let i = 1; i <= 3; i++) {
      result = await exchange.makeOrder(
        ETHER_ADDRESS,
        web3.utils.toWei((0.0001 * i).toFixed(6), 'ether'),
        token.address,
        tokens(10 * i),
        { from: user2 },
      );
      console.log(`Made order from ${user2}`);
      await wait(3);
    }

    // console.log('Exchange seeded successfully');
  } catch (error) {
    console.log(error);
    // console.error('Error seeding exchange:', error);
    // callback(error);
  }
  callback();
};
