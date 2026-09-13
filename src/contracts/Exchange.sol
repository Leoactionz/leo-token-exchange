// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// TODO:
// [ x ] Set the fee account
// [ x ] Desposit Ether
// [ x ] Withdraw Ether
// [ x ] Desposit Tokens
// [ x ] Withdraw Tokens
// [ x ] Check Balances
// [ x ] Make Order
// [ x ] Cancel Order
// [ ] Fill Order
// [ ] Charge Fees

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Exchange {
    // Variables
    address public feeAccount; // Account that receives exchange fees
    uint256 public feePercent; // Fee percentage
    address constant ETHER = address(0); // Store Ether in tokens mapping with blank address
    mapping(address => mapping(address => uint256)) public tokens;
    mapping(uint256 => _Order) public orders;
    uint256 public orderCount;
    mapping(uint256 => bool) public orderCancelled;
    mapping(uint256 => bool) public orderFilled;

    // Events
    event Deposit(address token, address user, uint256 amount, uint256 balance);
    event Withdraw(
        address token,
        address user,
        uint256 amount,
        uint256 balance
    );
    event Order(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );
    event Cancel(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );

    event Trade(
        uint256 id,
        address user,
        address userFill,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );

    // Structs
    struct _Order {
        uint256 id;
        address user;
        address tokenGet;
        uint256 amountGet;
        address tokenGive;
        uint256 amountGive;
        uint256 timestamp;
    }

    constructor(address _feeAccount, uint256 _feePercent) {
        feeAccount = _feeAccount;
        feePercent = _feePercent;
    }

    // Fallback: reverts if Ether is sent to this smart contract by mistake
    fallback() external {
        revert();
    }

    function depositEther() public payable {
        tokens[ETHER][msg.sender] += msg.value; // Track Ether deposits with token address 0
        emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]); // Emit event
    }

    function withdrawEther(uint256 _amount) public {
        require(tokens[ETHER][msg.sender] >= _amount, "Insufficient balance");
        tokens[ETHER][msg.sender] -= _amount; // Subtract from user balance
        payable(msg.sender).transfer(_amount); // Send Ether to user
        emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]); // Emit event
    }

    function depositTokens(address _token, uint256 _amount) public {
        // Don't allow Ether deposits
        require(_token != ETHER, "Invalid token address");
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount)
        );
        tokens[_token][msg.sender] += _amount;
        emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function withdrawToken(address _token, uint256 _amount) public {
        // perform withdrawal here to ensure `msg.sender` is the caller
        require(_token != ETHER, "Invalid token address");
        uint256 before = tokens[_token][msg.sender];
        require(before >= _amount, "Insufficient balance");
        tokens[_token][msg.sender] -= _amount;
        uint256 afterBalance = tokens[_token][msg.sender];
        require(IERC20(_token).transfer(msg.sender, _amount));
        emit Withdraw(_token, msg.sender, _amount, afterBalance);
    }

    function balanceOf(
        address _token,
        address _user
    ) public view returns (uint256) {
        return tokens[_token][_user];
    }

    function makeOrder(
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive
    ) public {
        // Require tokens (or Ether) to be deposited for the order
        require(
            balanceOf(_tokenGive, msg.sender) >= _amountGive,
            "Insufficient balance"
        );
        // Instantiate order
        orderCount++;
        orders[orderCount] = _Order(
            orderCount,
            msg.sender,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            block.timestamp
        );
        emit Order(
            orderCount,
            msg.sender,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            block.timestamp
        );
    }

    function cancelOrder(uint256 _id) public {
        _Order storage order = orders[_id];
        require(order.id == _id, "Order does not exist");
        require(order.user == msg.sender, "Unauthorized");
        // Must be "my" order
        // Must
        orderCancelled[_id] = true;
        emit Cancel(
            _id,
            msg.sender,
            orders[_id].tokenGet,
            orders[_id].amountGet,
            orders[_id].tokenGive,
            orders[_id].amountGive,
            block.timestamp
        );
    }

    function fillOrder(uint256 _id) public {
        require(_id > 0 && _id <= orderCount, "Invalid order ID");
        require(!orderCancelled[_id], "Order has been cancelled");
        _Order storage order = orders[_id];
        require(!orderFilled[_id], "Order has been filled");
        // Mark order filled before executing trade to prevent re-entrancy/double-fill
        orderFilled[_id] = true;
        // Execute the trade
        _trade(
            order.id,
            order.user,
            order.tokenGet,
            order.amountGet,
            order.tokenGive,
            order.amountGive
        );
    }

    function _trade(
        uint256 _orderId,
        address _user,
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive
    ) internal {
        // Fee is paid by the user who fills the order (msg.sender)
        uint256 feeAmount = (_amountGet * feePercent) / 100;

        // Execute the trade
        // msg.sender is the user who fills the order, while `_user` is the user who created the order
        tokens[_tokenGet][msg.sender] -= (_amountGet + feeAmount); // Subtract from filler
        tokens[_tokenGet][_user] += _amountGet; // Add to order creator
        tokens[_tokenGet][feeAccount] += feeAmount; // Add fee to feeAccount

        tokens[_tokenGive][_user] -= _amountGive; // Subtract from order creator
        tokens[_tokenGive][msg.sender] += _amountGive; // Add to filler

        // Emit trade event
        emit Trade(
            _orderId,
            _user,
            msg.sender,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            block.timestamp
        );
    }
}
