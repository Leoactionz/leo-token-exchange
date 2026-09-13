// stray import removed: lodash 'before' shadows Mocha's hook
const { tokens, ether, EVM_REVERT, ETHER_ADDRESS } = require('./helpers.js');
// const assert = require('assert');

const Token = artifacts.require('./Token'); // ↑ This loads the compiled Token contract artifact
const Exchange = artifacts.require('./Exchange'); // ↑ This loads the compiled Token contract artifact

require('chai').use(require('chai-as-promised')).should();

contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
  let token;
  let exchange;
  const feePercent = 10;

  before(async () => {
    // Deploy token
    token = await Token.new();

    // Transfer some tokens to user1
    await token.transfer(user1, tokens(100), { from: deployer });

    // Deploy exchange
    exchange = await Exchange.new(feeAccount, feePercent);
  });

  describe('deployment', () => {
    it('tracks the fee account', async () => {
      const result = await exchange.feeAccount();
      result.should.equal(feeAccount);
    });

    it('tracks the fee percent', async () => {
      const result = await exchange.feePercent();
      result.toString().should.equal(feePercent.toString());
    });
  });

  describe('fallback', () => {
    it('reverts when Ether is sent', async () => {
      await exchange
        .sendTransaction({
          from: user1,
          to: exchange.address,
          value: ether(1),
        })
        .should.be.rejectedWith(EVM_REVERT);
    });
  });

  describe('depositing Ether', () => {
    let result;
    let amount;

    before(async () => {
      // amount = ether(1);
      amount = web3.utils.toWei('1', 'ether');
      result = await exchange.depositEther({ from: user1, value: amount });
    });

    it('tracks the Ether deposit', async () => {
      const balance = await exchange.tokens(ETHER_ADDRESS, user1);
      balance.toString().should.equal(amount.toString());
    });

    it('emits a desposit event', async () => {
      const log = result.logs[0];
      log.event.should.equal('Deposit');
      const event = log.args;
      event.token.should.equal(ETHER_ADDRESS, 'token address is correct');
      event.user.should.equal(user1, 'user address is correct');
      event.amount
        .toString()
        .should.equal(amount.toString(), 'amount is correct');
      event.balance
        .toString()
        .should.equal(amount.toString(), 'balance is correct');
    });

    describe('failure', () => {
      // it('rejects Ether deposits', async () => {
      //   await exchange
      //     .depositEther({ from: user1, value: 0 })
      //     .should.be.rejectedWith(EVM_REVERT);
      // });
    });
  });

  describe('withdrawing Ether', () => {
    let result;
    let depositAmount;
    let withdrawAmount;

    describe('success', () => {
      before(async () => {
        // First deposit Ether
        depositAmount = web3.utils.toWei('1', 'ether');
        await exchange.depositEther({ from: user1, value: depositAmount });

        // Withdraw the full exchange balance for user1
        withdrawAmount = await exchange.tokens(ETHER_ADDRESS, user1);
        result = await exchange.withdrawEther(withdrawAmount, { from: user1 });
      });

      it('withdraws Ether funds', async () => {
        const balance = await exchange.tokens(ETHER_ADDRESS, user1);
        balance.toString().should.equal('0');
      });

      it('emits a "Withdraw" event', async () => {
        const log = result.logs[0];
        log.event.should.equal('Withdraw');
        const event = log.args;
        event.token.should.equal(ETHER_ADDRESS, 'token address is correct');
        event.user.should.equal(user1, 'user address is correct');
        event.amount
          .toString()
          .should.equal(withdrawAmount.toString(), 'amount is correct');
        event.balance
          .toString()
          .should.equal('0', 'balance is correct after withdrawal');
      });
    });

    describe('failure', () => {
      it('rejects withdraws for insufficient balances', async () => {
        await exchange
          .withdrawEther(ether(100), { from: user1 })
          .should.be.rejectedWith(EVM_REVERT);
      });
    });
  });

  describe('depositing tokens', () => {
    let amount;
    let result;

    describe('success', () => {
      before(async () => {
        amount = tokens(10);
        await token.approve(exchange.address, amount, { from: user1 });
        result = await exchange.depositTokens(token.address, amount, {
          from: user1,
        });
      });

      it('tracks the token deposit', async () => {
        // Check exchange token balance
        let balance;
        balance = await token.balanceOf(exchange.address);
        balance.toString().should.equal(amount.toString());
        // Check user balance on exchange
        balance = await exchange.tokens(token.address, user1);
        balance.toString().should.equal(amount.toString());
      });

      it('emits a desposit event', async () => {
        const log = result.logs[0];
        log.event.should.equal('Deposit');
        const event = log.args;
        event.token.should.equal(token.address, 'token address is correct');
        event.user.should.equal(user1, 'user address is correct');
        event.amount
          .toString()
          .should.equal(amount.toString(), 'amount is correct');
        event.balance
          .toString()
          .should.equal(amount.toString(), 'balance is correct');
      });

      // clean up deposit to avoid affecting later tests
      after(async () => {
        await exchange.withdrawToken(token.address, amount, { from: user1 });
      });
    });

    describe('failure', () => {
      it('rejects Ether deposits', async () => {
        await exchange
          .depositTokens(
            ETHER_ADDRESS,
            tokens(10),
            // { from: user1, value: tokens(10) },
            { from: user1 },
          )
          .should.be.rejectedWith(EVM_REVERT);
      });

      it('fails when no tokens are approved', async () => {
        // Don't approve any tokens before depositing
        await exchange
          .depositTokens(
            token.address,
            tokens(10),
            // { from: user1, value: tokens(10) },
            { from: user1 },
          )
          .should.be.rejectedWith(EVM_REVERT);
      });
    });
  });

  describe('withdrawing tokens', () => {
    let result;
    let amount;

    describe('success', () => {
      before(async () => {
        // First deposit Ether
        amount = tokens(10);
        await token.approve(exchange.address, amount, { from: user1 });
        await exchange.depositTokens(token.address, amount, { from: user1 });

        // Withdraw tokens from exchange
        result = await exchange.withdrawToken(token.address, amount, {
          from: user1,
        });
      });

      it('withdraws token funds', async () => {
        const balance = await exchange.tokens(token.address, user1);
        balance.toString().should.equal('0');
      });

      it('emits a "Withdraw" event', async () => {
        const log = result.logs[0];
        log.event.should.equal('Withdraw');
        const event = log.args;
        event.token.should.equal(token.address, 'token address is correct');
        event.user.should.equal(user1, 'user address is correct');
        event.amount
          .toString()
          .should.equal(amount.toString(), 'amount is correct');
        event.balance
          .toString()
          .should.equal('0', 'balance is correct after withdrawal');
      });
    });

    describe('failure', () => {
      it('rejects Ether withdraws', async () => {
        await exchange
          .withdrawToken(ETHER_ADDRESS, tokens(10), { from: user1 })
          .should.be.rejectedWith(EVM_REVERT);
      });

      it('fails for insufficient balances', async () => {
        await exchange
          .withdrawToken(token.address, tokens(100), { from: user1 })
          .should.be.rejectedWith(EVM_REVERT);
      });
    });
  });

  describe('checking balances', async () => {
    before(async () => {
      await exchange.depositEther({ from: user1, value: ether(1) });
      // token.approve(exchange.address, tokens(10), { from: user1 });
      // exchange.depositTokens(token.address, tokens(10), { from: user1 });
    });

    it('returns user balance', async () => {
      const result = await exchange.balanceOf(ETHER_ADDRESS, user1);
      result.toString().should.equal(ether(1).toString());
      // balance = await exchange.balanceOf(token.address, user1);
      // balance.toString().should.equal(tokens(10).toString());
    });
  });

  describe('making orders', () => {
    let result;

    before(async () => {
      result = await exchange.makeOrder(
        token.address,
        tokens(1),
        ETHER_ADDRESS,
        ether(1),
        { from: user1 },
      );
    });

    it('tracks the newly created order', async () => {
      const orderCount = await exchange.orderCount();
      orderCount.toString().should.equal('1');
      const order = await exchange.orders(orderCount);
      order.id.toString().should.equal('1', 'id is correct');
      order.user.should.equal(user1, 'user is correct');
      order.tokenGet.should.equal(token.address, 'tokenGet is correct');
      order.amountGet
        .toString()
        .should.equal(tokens(1).toString(), 'amountGet is correct');
      order.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct');
      order.amountGive
        .toString()
        .should.equal(ether(1).toString(), 'amountGive is correct');
      order.timestamp
        .toString()
        .length.should.be.at.least(1, 'timestamp is present');
    });

    it('emits an "Order" event', async () => {
      const log = result.logs[0];
      log.event.should.equal('Order');
      const event = log.args;
      event.id.toString().should.equal('1', 'id is correct');
      event.user.should.equal(user1, 'user is correct');
      event.tokenGet.should.equal(token.address, 'tokenGet is correct');
      event.amountGet
        .toString()
        .should.equal(tokens(1).toString(), 'amountGet is correct');
      event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct');
      event.amountGive
        .toString()
        .should.equal(ether(1).toString(), 'amountGive is correct');
      event.timestamp
        .toString()
        .length.should.be.at.least(1, 'timestamp is present');
    });
  });

  describe('orders actions', () => {
    let ordersActionOrderId;

    before(async () => {
      // user1 makes an order to buy 1 token for 1 ether
      // deposit 1 ether so user1 can make an order to buy tokens
      await exchange.depositEther({ from: user1, value: ether(1) });
      // give tokens to user2
      await token.transfer(user2, tokens(100), { from: deployer });
      // user2 approves exchange to spend tokens before user1 makes an order
      await token.approve(exchange.address, tokens(2), { from: user2 });
      await exchange.depositTokens(token.address, tokens(2), { from: user2 });
      await exchange.makeOrder(
        token.address,
        tokens(1),
        ETHER_ADDRESS,
        ether(1),
        { from: user1 },
      );
      // capture the specific order id created for these actions
      ordersActionOrderId = await exchange.orderCount();
    });

    describe('filling orders', () => {
      let result;
      let orderId;
      let preUser1Ether;

      describe('success', async () => {
        before(async () => {
          // fill the specific order created in the enclosing before-hook
          orderId = ordersActionOrderId;
          // capture user1 Ether balance before filling so assertions are robust
          preUser1Ether = await exchange.balanceOf(ETHER_ADDRESS, user1);
          result = await exchange.fillOrder(orderId, { from: user2 });
        });

        it('executes the trade and charges fees', async () => {
          // Check balances after trade with fees
          let balance;
          balance = await exchange.balanceOf(token.address, user1);
          balance
            .toString()
            .should.equal(tokens(1).toString(), 'User1 received the tokens');
          balance = await exchange.balanceOf(ETHER_ADDRESS, user2);
          balance
            .toString()
            .should.equal(ether(1).toString(), 'User2 received Ether');
          balance = await exchange.balanceOf(ETHER_ADDRESS, user1);
          const expected = web3.utils
            .toBN(preUser1Ether.toString())
            .sub(web3.utils.toBN(ether(1)));
          balance
            .toString()
            .should.equal(expected.toString(), 'user1 Ether deducted');
          balance = await exchange.balanceOf(token.address, user2);
          (balance.toString().should.equal(tokens(0.9).toString()),
            'user2 tokens deducted with fee applied');
          const feeAccount = await exchange.feeAccount();
          balance = await exchange.balanceOf(token.address, feeAccount);
          balance
            .toString()
            .should.equal(
              tokens(0.1).toString(),
              'feeAccount received the fee',
            );
        });

        it('updates filled orders', async () => {
          const orderFilled = await exchange.orderFilled(orderId);
          orderFilled.should.equal(true);
        });

        it('emits a "Trade" event', async () => {
          const log = result.logs[0];
          log.event.should.equal('Trade');
          const event = log.args;
          event.id.toString().should.equal(orderId.toString(), 'id is correct');
          event.user.should.equal(user1, 'user is correct');
          event.tokenGet.should.equal(token.address, 'tokenGet is correct');
          event.amountGet
            .toString()
            .should.equal(tokens(1).toString(), 'amountGet is correct');
          event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct');
          event.amountGive
            .toString()
            .should.equal(ether(1).toString(), 'amountGive is correct');
          event.userFill.should.equal(user2, 'userFill is correct');
          event.timestamp
            .toString()
            .length.should.be.at.least(1, 'timestamp is present');
        });
      });
    });

    describe('failure', () => {
      it('rejects invalid order ids', async () => {
        await exchange
          .fillOrder(9999, { from: user2 })
          .should.be.rejectedWith(EVM_REVERT);
      });

      it('rejects already filled orders', async () => {
        // Create a fresh order for this test to avoid cross-test state
        await exchange.makeOrder(
          token.address,
          tokens(1),
          ETHER_ADDRESS,
          ether(1),
          { from: user1 },
        );
        const orderId = await exchange.orderCount();
        // Ensure user2 has approved and deposited enough tokens to fill the order
        await token.transfer(user2, tokens(100), { from: deployer });
        await token.approve(exchange.address, tokens(2), { from: user2 });
        await exchange.depositTokens(token.address, tokens(2), { from: user2 });
        await exchange.fillOrder(orderId, { from: user2 }).should.be.fulfilled; // First fill the order
        await exchange
          .fillOrder(orderId, { from: user2 })
          .should.be.rejectedWith(EVM_REVERT);
      });

      it('rejects cancelled orders', async () => {
        // First cancel the order
        await exchange.cancelOrder(1, { from: user1 }).should.be.fulfilled;
        // Then try to fill the cancelled order
        await exchange
          .fillOrder(1, { from: user2 })
          .should.be.rejectedWith(EVM_REVERT);
      });
    });

    describe('cancelling orders', () => {
      let result;

      describe('success', async () => {
        before(async () => {
          result = await exchange.cancelOrder(1, { from: user1 });
        });

        it('updates cancelled orders', async () => {
          const orderCancelled = await exchange.orderCancelled(1);
          orderCancelled.should.equal(true);
        });

        it('emits a "Cancel" event', async () => {
          const log = result.logs[0];
          log.event.should.equal('Cancel');
          const event = log.args;
          event.id.toString().should.equal('1', 'id is correct');
          event.user.should.equal(user1, 'user is correct');
          event.tokenGet.should.equal(token.address, 'tokenGet is correct');
          event.amountGet
            .toString()
            .should.equal(tokens(1).toString(), 'amountGet is correct');
          event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct');
          event.amountGive
            .toString()
            .should.equal(ether(1).toString(), 'amountGive is correct');
          event.timestamp
            .toString()
            .length.should.be.at.least(1, 'timestamp is present');
        });
      });

      describe('failure', async () => {
        it('rejects invalid order ids', async () => {
          await exchange
            .cancelOrder(999, { from: user1 })
            .should.be.rejectedWith(EVM_REVERT);
        });

        it('rejects unauthorized cancellations', async () => {
          await exchange
            .cancelOrder(1, { from: user2 })
            .should.be.rejectedWith(EVM_REVERT);
        });
      });
    });
  });
});
