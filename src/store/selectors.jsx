
import { get, groupBy, reject, maxBy, minBy } from 'lodash'
import { createSelector } from 'reselect'
import moment from 'moment'
import { ether, ETHER_ADDRESS, GREEN, RED, tokens } from '../helpers'
import { etherDepositAmountChanged } from './actions'

// TODO: Move formatBalance to helpers file
export const formatBalance = (balance) => {
    const precision = 100 // 2 decimal places
    balance = ether(balance)
    balance = Math.round(balance * precision) / precision // 2 decimal places

    return balance
}

const account = state => get(state, 'web3.account')
export const accountSelector = createSelector(account, (account) => account)

const web3 = state => get(state, 'web3.connection')
export const web3Selector = createSelector(web3, (web3) => web3)

const tokenLoaded = state => get(state, 'token.loaded', false)
export const tokenLoadedSelector = createSelector(tokenLoaded, (tokenLoaded) => tokenLoaded)

const token = state => get(state, 'token.contract')
export const tokenSelector = createSelector(token, (token) => token)

const exchangeLoaded = state => get(state, 'exchange.loaded', false)
export const exchangeLoadedSelector = createSelector(exchangeLoaded, (exchangeLoaded) => exchangeLoaded)

const exchange = state => get(state, 'exchange.contract')
export const exchangeSelector = createSelector(exchange, (exchange) => exchange)


export const contractLoadedSelector = createSelector(
    tokenLoaded,
    exchangeLoaded,
    (tokenLoaded, exchangeLoaded) => tokenLoaded && exchangeLoaded
)

// All orders
const allOrdersLoaded = state => get(state, 'exchange.allOrders.loaded', false)


const allOrders = state => get(state, 'exchange.allOrders.data', [])
// export const allOrdersSelector = createSelector(allOrders, (allOrders) => allOrders)

// Cancelled Orders
const cancelledOrdersLoaded = state => get(state, 'exchange.cancelledOrders.loaded', false)
export const cancelledOrdersLoadedSelector = createSelector(cancelledOrdersLoaded, (cancelledOrdersLoaded) => cancelledOrdersLoaded)

const cancelledOrders = state => get(state, 'exchange.cancelledOrders.data', [])
export const cancelledOrdersSelector = createSelector(
    cancelledOrders,
    (orders) => orders
)



// Filled Orders Loaded
const filledOrdersLoaded = state => get(state, 'exchange.filledOrders.loaded', false)
export const filledOrdersLoadedSelector = createSelector(filledOrdersLoaded, (filledOrdersLoaded) => filledOrdersLoaded)


// Filled Orders
const filledOrders = state => get(state, 'exchange.filledOrders.data', [])
export const filledOrdersSelector = createSelector(
    filledOrders,
    (orders) => {
        // Sort orders by date ascending for price comparison
        orders = orders.sort((a, b) => a.timestamp - b.timestamp)

        // Decorate the orders
        orders = decoratedFilledOrders(orders)

        // Sort orders by date descending for disply
        orders = orders.sort((a, b) => b.timestamp - a.timestamp)
        return orders
    }
)


const decoratedFilledOrders = (orders) => {
    // Track previoius order to compare history
    let previousOrder = [0] // Initialize 
    return (
        orders.map((order) => {
            order = decorateOrder(order)
            order = decoratedFilledOrder(order, previousOrder)
            previousOrder = order // Update the previous order once it's decorated

            return order
        })
    )
}

const decorateOrder = (order) => {
    let etherAmount, tokenAmount
    if (order.tokenGive === ETHER_ADDRESS) {
        etherAmount = order.amountGive
        tokenAmount = order.amountGet
    }
    else {
        etherAmount = order.amountGet
        tokenAmount = order.amountGive
    }

    // Calculate token price to 5 decimal places
    const precision = 100000
    let tokenPrice = (etherAmount / tokenAmount)
    tokenPrice = Math.round(tokenPrice * precision) / precision

    return {
        ...order,
        etherAmount: ether(etherAmount),
        tokenAmount: tokens(tokenAmount),
        tokenPrice,
        formattedTimeStamp: moment.unix(Number(order.timestamp)).local().format('DD MMM, HH:mm:ss')
    }
}

const decoratedFilledOrder = (order, previousOrder) => {
    return ({
        ...order,
        tokenPriceClass: tokenPriceClass(order.tokenPrice, order.id, previousOrder),

    })
}

const tokenPriceClass = (tokenPrice, orderId, previousOrder) => {
    if (previousOrder.id === orderId) {
        return GREEN
    }

    if (previousOrder.tokenPrice <= tokenPrice) {
        return GREEN
    } else {
        return RED
    }
}

const openOrders = state => {
    const all = allOrders(state)
    const filled = filledOrders(state)
    const cancelled = cancelledOrders(state)

    const openOrders = reject(all, (order) => {
        const orderFilled = filled.some((o) => o.id === order.id)
        const orderCancelled = cancelled.some((o) => o.id === order.id)

        return orderFilled || orderCancelled
    })

    return openOrders
}

const orderBookLoaded = state => cancelledOrdersLoaded(state) && filledOrdersLoaded(state) && allOrdersLoaded(state)
export const orderBookLoadedSelector = createSelector(orderBookLoaded, (loaded) => loaded)

// Create the order book
export const orderBookSelector = createSelector(
    openOrders,
    (orders) => {
        // Decorate the orders
        orders = decoratedOrderBookOrders(orders)
        // Group orders by "orderType"
        orders = groupBy(orders, 'orderType')
        // Fetch buy orders
        const buyOrders = get(orders, 'buy', [])
        // Sort buy orders by token price 
        orders = {
            ...orders,
            buyOrders: buyOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
        }
        // Fetch sell orders
        const sellOrders = get(orders, 'sell', [])
        // Sort sell orders by token price 
        orders = {
            ...orders,
            sellOrders: sellOrders.sort((a, b) => a.tokenPrice - b.tokenPrice)
        }
        return orders
    }
)

const decoratedOrderBookOrders = (orders) => {
    return (
        orders.map((order) => {
            order = decorateOrder(order)
            order = decorateOrderBookOrder(order)
            return order
        })
    )
}

const decorateOrderBookOrder = (order) => {
    const orderType = order.tokenGive === ETHER_ADDRESS ? 'buy' : 'sell'

    return ({
        ...order,
        orderType,
        orderTypeClass: (orderType === 'buy' ? GREEN : RED),
        orderFillAction: orderType === 'buy' ? 'sell' : 'buy'
    })
}


export const myFilledOrdersLoadedSelector = createSelector(
    filledOrdersLoaded, loaded => loaded
)

export const myFilledOrdersSelector = createSelector(
    account,
    filledOrders,
    (account, orders) => {
        // Find our orders
        orders = orders.filter((o) => o.user === account || o.userFill === account)
        // Sort by date ascending
        orders = orders.sort((a, b) => a.timestamp - b.timestamp)
        // Decorate the orders - add display attributes
        orders = decorateMyFilledOrders(orders, account)
        return orders
    }
)

const decorateMyFilledOrders = (orders, account) => {
    return (
        orders.map((order) => {
            order = decorateOrder(order)
            order = decorateMyFilledOrder(order, account)
            return order
        })
    )
}

const decorateMyFilledOrder = (order, account) => {
    const myOrder = order.user === account

    let orderType
    if (myOrder) {
        orderType = order.tokenGive === ETHER_ADDRESS ? 'buy' : 'sell'
    }
    else {
        orderType = order.tokenGive === ETHER_ADDRESS ? 'sell' : 'buy'
    }

    return ({
        ...order,
        orderType,
        orderTypeClass: orderType === 'buy' ? GREEN : RED,
        orderSign: orderType === 'buy' ? '+' : '-'  // The color of the AmountReceived column
    })
}

export const myOpenOrdersLoadedSelector = createSelector(
    orderBookLoaded,
    loaded => loaded
)

export const myOpenOrdersSelector = createSelector(
    account,
    openOrders,
    (account, openOrders) => {
        // Filter orders created by current account
        let orders = openOrders.filter((order) => order.user === account)
        // Decorate the orders - add display attributes
        orders = decorateMyOpenOrders(orders)
        // Sort by date descending
        orders = orders.sort((a, b) => b.timestamp - a.timestamp)
        return orders
    }
)

const decorateMyOpenOrders = (orders, account) => {
    return (
        orders.map((order) => {
            order = decorateOrder(order)
            order = decorateMyOpenOrder(order, account)
            return order
        })
    )
}

const decorateMyOpenOrder = (order, account) => {
    const orderType = order.tokenGive === ETHER_ADDRESS ? 'buy' : 'sell'

    return ({
        ...order,
        orderType,
        orderTypeClass: orderType === 'buy' ? GREEN : RED,
    })
}

export const priceChartLoadedSelector = createSelector(
    filledOrdersLoaded,
    loaded => loaded
)

export const priceChartSelector = createSelector(
    filledOrders,
    (orders) => {
        // Sort orders by date ascending for price comparison
        orders = orders.sort((a, b) => a.timestamp - b.timestamp)
        // Decorate the orders
        orders = decoratePriceChartOrders(orders)
        // Get last 2 order for final price change
        const [secondLastOrder, lastOrder] = orders.slice(orders.length - 2, orders.length)
        // get last order price
        const lastPrice = get(lastOrder, 'tokenPrice', 0)
        // get second last order price
        const secondLastPrice = get(secondLastOrder, 'tokenPrice', 0)

        return ({
            lastPrice,
            lastPriceChange: lastPrice >= secondLastPrice ? '+' : '-',
            series: [{
                data: buildGraphData(orders)
            }]
        })
    }
)



const buildGraphData = (orders) => {
    // Group the orders by hour for the graph
    orders = groupBy(orders, order => moment.unix(order.timestamp).startOf('hour').format())
    // Get each hour where data exists
    const hours = Object.keys(orders)
    // Build the graph series
    const graphData = hours.map(hour => {
        // Fetch all the orders for that hour
        const group = orders[hour]
        // Calculate price values - open, high, low , close
        const open = group[0]
        const high = maxBy(group, 'tokenPrice')
        const low = minBy(group, 'tokenPrice')
        const close = group[group.length - 1]
        return {
            x: new Date(hour),
            y: [open.tokenPrice, high.tokenPrice, low.tokenPrice, close.tokenPrice]
        }
    })
    return graphData
}

const decoratePriceChartOrders = (orders) => {
    return (
        orders.map((order) => {
            order = decorateOrder(order)
            return order
        })
    )
}

const orderCancelling = state => get(state, 'exchange.orderCancelling', false)
export const orderCancellingSelector = createSelector(orderCancelling, status => status)

const orderFilling = state => get(state, 'exchange.orderFilling', false)
export const orderFillingSelector = createSelector(orderFilling, status => status)

// Balance selectors
const balancesLoading = state => get(state, 'exchange.balancesLoading', true)
export const balancesLoadingSelector = createSelector(balancesLoading, status => status)

const etherBalance = state => get(state, 'web3.etherBalance', 0)
export const etherBalanceSelector = createSelector(etherBalance, balance => formatBalance(balance))

const tokenBalance = state => get(state, 'token.balance', 0)
export const tokenBalanceSelector = createSelector(tokenBalance, balance => formatBalance(balance))

const exchangeEtherBalance = state => get(state, 'exchange.etherBalance', 0)
export const exchangeEtherBalanceSelector = createSelector(exchangeEtherBalance, balance => formatBalance(balance))

const exchangeTokenBalance = state => get(state, 'exchange.tokenBalance', 0)
export const exchangeTokenBalanceSelector = createSelector(exchangeTokenBalance, balance => formatBalance(balance))

const etherDepositAmount = state => get(state, 'exchange.etherDepositAmount', null)
export const etherDepositAmountSelector = createSelector(etherDepositAmount, amount => amount)

const etherWithdrawAmount = state => get(state, 'exchange.etherWithdrawAmount', null)
export const etherWithdrawAmountSelector = createSelector(etherWithdrawAmount, amount => amount)

const tokenDepositAmount = state => get(state, 'exchange.tokenDepositAmount', null)
export const tokenDepositAmountSelector = createSelector(tokenDepositAmount, amount => amount)

const tokenWithdrawAmount = state => get(state, 'exchange.tokenWithdrawAmount', null)
export const tokenWithdrawAmountSelector = createSelector(tokenWithdrawAmount, amount => amount)

const buyOrder = state => get(state, 'exchange.buyOrder', {})
export const buyOrderSelector = createSelector(buyOrder, order => order)

const sellOrder = state => get(state, 'exchange.sellOrder', {})
export const sellOrderSelector = createSelector(sellOrder, order => order)