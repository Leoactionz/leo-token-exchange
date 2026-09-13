import Web3 from 'web3'
import {
    web3Loaded,
    web3AccountLoaded,
    tokenLoaded,
    exchangeLoaded,
    cancelledOrdersLoaded,
    filledOrdersLoaded,
    allOrdersLoaded,
    orderCancelling,
    orderCancelled,
    orderFilling,
    orderFilled,
    etherBalanceLoaded,
    tokenBalanceLoaded,
    exchangeEtherBalanceLoaded,
    exchangeTokenBalanceLoaded,
    balancesLoaded,
    balancesLoading,
    buyOrderMaking,
    sellOrderMaking,
    orderMade
} from './actions'
import Token from '../abis/Token.json'
import Exchange from '../abis/Exchange.json'
import { ETHER_ADDRESS } from '../helpers'

export const loadWeb3 = (dispatch) => {
    const web3 = new Web3(window.ethereum)
    dispatch(web3Loaded(web3))
    return web3
}

export const loadAccount = async (web3, dispatch) => {
    const accounts = await web3.eth.getAccounts()
    dispatch(web3AccountLoaded(accounts[0]))
    return accounts[0]
}

export const loadToken = async (web3, networkId, dispatch) => {
    try {
        const token = new web3.eth.Contract(Token.abi, Token.networks[networkId].address)
        dispatch(tokenLoaded(token))
        return token
    } catch (error) {
        console.log('Contract not deployed to the current network. Please select another network with MetaMask.')
        return null
    }
}

export const loadExchange = async (web3, networkId, dispatch) => {
    try {
        const exchange = new web3.eth.Contract(Exchange.abi, Exchange.networks[networkId].address)
        dispatch(exchangeLoaded(exchange))
        return exchange
    } catch (error) {
        console.log('Contract not deployed to the current network. Please select another network with MetaMask.')
        return null
    }
}

export const loadAllOrders = async (exchange, dispatch) => {
    // Fetch cancelled orders with the "Cancelled" event stream 
    const cancelStream = await exchange.getPastEvents('Cancel', { fromBlock: 0, toBlock: 'latest' })
    // Format cancelled orders array
    const cancelledOrders = cancelStream.map(event => event.returnValues)
    // Add cancelled orders to the redux store
    dispatch(cancelledOrdersLoaded(cancelledOrders))
    // Fetch filled orders with the "Trade" event stream
    const filledStream = await exchange.getPastEvents('Trade', { fromBlock: 0, toBlock: 'latest' })
    // Format filled orders array
    const filledOrders = filledStream.map(event => event.returnValues)
    // Add filled orders to the redux store
    dispatch(filledOrdersLoaded(filledOrders))

    // Load order stream
    const ordersStream = await exchange.getPastEvents('Order', { fromBlock: 0, toBlock: 'latest' })
    // Format orders array
    const allOrders = ordersStream.map(event => event.returnValues)
    // Add orders to the redux store
    dispatch(allOrdersLoaded(allOrders))

}

export const subscribeToEvents = async (exchange, dispatch) => {
    exchange.events.Cancel({}, (error, event) => {
        dispatch(orderCancelled(event.returnValues))
    })

    exchange.events.Trade({}, (error, event) => {
        dispatch(orderFilled(event.returnValues))
    })

    exchange.events.Deposit({}, (error, event) => {
        dispatch(balancesLoaded())
    })

    exchange.events.Withdraw({}, (error, event) => {
        dispatch(balancesLoaded())
    })

    exchange.events.Order({}, (error, event) => {
        dispatch(orderMade(event.returnValues))
    })
}

export const cancelOrder = (exchange, order, account, dispatch) => {
    exchange.methods.cancelOrder(order.id).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(orderCancelling())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error cancelling the order')
        })
}


export const fillOrder = (dispatch, exchange, order, account) => {
    exchange.methods.fillOrder(order.id).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(orderFilling())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error cancelling the order')
        })
}

export const loadBalances = async (dispatch, web3, exchange, token, account) => {
    try {
        // Ether balance in wallet
        const etherBalance = await web3.eth.getBalance(account)
        dispatch(etherBalanceLoaded(etherBalance))

        // Token balance in wallet
        const tokenBalance = await token.methods.balanceOf(account).call()
        dispatch(tokenBalanceLoaded(tokenBalance))

        // Ether balance in exchange
        const exchangeEtherBalance = await exchange.methods.balanceOf(ETHER_ADDRESS, account).call()
        dispatch(exchangeEtherBalanceLoaded(exchangeEtherBalance))

        // Token balance in exchange
        const exchangeTokenBalance = await exchange.methods.balanceOf(token.options.address, account).call()
        dispatch(exchangeTokenBalanceLoaded(exchangeTokenBalance))

        // Trigger all balances loaded
        dispatch(balancesLoaded())

    } catch (error) {
        console.log(error)
    }
}

export const depositEther = (dispatch, exchange, web3, amount, account) => {
    exchange.methods.depositEther().send({ from: account, value: web3.utils.toWei(amount, 'ether') })
        .on('transactionHash', (hash) => {
            dispatch(balancesLoading())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error depositing the ether')
        })
}

export const withdrawEther = (dispatch, exchange, web3, amount, account) => {
    exchange.methods.withdrawEther(web3.utils.toWei(amount, 'ether')).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(balancesLoading())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error withdrawing the ether')
        })
}

export const depositToken = (dispatch, exchange, web3, token, amount, account) => {
    amount = web3.utils.toWei(amount, 'ether')

    token.methods.approve(exchange.options.address, amount).send({ from: account })
        .on('transactionHash', (hash) => {
            exchange.methods.depositTokens(token.options.address, amount).send({ from: account })
                .on('transactionHash', (hash) => {
                    dispatch(balancesLoading())
                })
                .on('receipt', (receipt) => {
                    console.log(receipt)
                })
                .on('error', (error) => {
                    console.log(error)
                    window.alert('There was an error depositing the token')
                })
        })
}

export const withdrawToken = (dispatch, exchange, web3, token, amount, account) => {
    amount = web3.utils.toWei(amount, 'ether')

    exchange.methods.withdrawToken(token.options.address, amount).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(balancesLoading())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error withdrawing the token')
        })
}

export const makeBuyOrder = (dispatch, exchange, token, web3, order, account) => {
    const tokenGet = token.options.address
    const amountGet = web3.utils.toWei(order.amount, 'ether')
    const tokenGive = ETHER_ADDRESS
    const amountGive = web3.utils.toWei((order.amount * order.price).toString(), 'ether')

    exchange.methods.makeOrder(tokenGet, amountGet, tokenGive, amountGive).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(buyOrderMaking())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error making the buy order')
        })
}

export const makeSellOrder = (dispatch, exchange, token, web3, order, account) => {
    const tokenGet = ETHER_ADDRESS
    const amountGet = web3.utils.toWei((order.amount * order.price).toString(), 'ether')
    const tokenGive = token.options.address
    const amountGive = web3.utils.toWei(order.amount, 'ether')

    exchange.methods.makeOrder(tokenGet, amountGet, tokenGive, amountGive).send({ from: account })
        .on('transactionHash', (hash) => {
            dispatch(sellOrderMaking())
        })
        .on('receipt', (receipt) => {
            console.log(receipt)
        })
        .on('error', (error) => {
            console.log(error)
            window.alert('There was an error making the sell order')
        })
}