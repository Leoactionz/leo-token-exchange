// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    // Variables
    string public name = "LEO Token";
    string public symbol = "LEO";
    uint256 public decimals = 18;
    uint256 public totalSupply;

    // Track balances of each address
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor() {
        totalSupply = 1000000 * (10 ** uint256(decimals));
        balanceOf[msg.sender] = totalSupply; // Assign all tokens to contract deployer
    }

    function transfer(
        address _to,
        uint256 _value
    ) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        _transfer(msg.sender, _to, _value);
        return true;
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) internal returns (bool success) {
        require(_to != address(0), "Invalid recipient address");
        // require(balanceOf[_from] >= _value, "Insufficient balance");
        balanceOf[_from] -= _value; // Subtract from sender
        balanceOf[_to] += _value; // Add to recipient
        emit Transfer(_from, _to, _value); // Emit transfer event
        return true;
    }

    function approve(
        address _spender,
        uint256 _value
    ) public returns (bool success) {
        require(_spender != address(0), "Invalid recipient address");
        allowance[msg.sender][_spender] = _value; // Set allowance
        emit Approval(msg.sender, _spender, _value); // Emit approval event
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool success) {
        require(_value <= balanceOf[_from]);
        require(_value <= allowance[_from][msg.sender]);
        allowance[_from][msg.sender] -= _value; // Subtract from allowance
        _transfer(_from, _to, _value);
        return true;
    }
}
