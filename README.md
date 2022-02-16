# market-example-contingent

![Build Status](https://github.com/DrPaulBrewer/market-example-contingent/actions/workflows/node.js.yml/badge.svg)

[![Known Vulnerabilities](https://snyk.io/test/github/DrPaulBrewer/market-example-contingent/badge.svg)]
(https://snyk.io/test/github/DrPaulBrewer/market-example-contingent)



### Provides exchange Market with time-based and cancellable limit orders, and contingent orders such as stop, OSO (one-sends-others) and OCO (one-cancels-others)

Built using market-engine, market-pricing, and partial-index packages also posted on npm

## Breaking Changes in v3

### Module changes
v3 is ESM whereas versions 2 and earlier were commonjs.

### removing babel dependencies
v3 is not compiled with Babel

## Installation

    npm install market-example-contingent --save

## Initialization

    import * as MEC from 'market-example-contingent'; // ES6

    const MEC = require('market-example-contingent'); // CJS

    const XMarket = new MEC.Market({money:'coins', goods:'X', ...other options...});

## Provides
* `new MEC.Market(config)` constructor function for Market.  
* `MEC.orderHeader` 19 element array of strings, giving column headers for internal order array format
* `MEC.oa(order_object)` function for converting orders from object format to array format
* `MEC.ao(order_array)` function for converting orders from array format to object format

## Inheritance Diagram

`MEC.Market` inherits linearly from `market-engine` and `EventEmitter` and constructors are chained.

```
EventEmitter
     |
market-engine (npm)
     |
MEC.Market
```

This means `MEC.Market` understands `.push(some_order)` and `.trade(tradeSpec)` from
[`market-engine`](https://www.npmjs.com/package/market-engine)
as well as `.on('someEvent', function(params){ ... })` and `.emit('someEvent')` from
[`EventEmitter`](https://nodejs.org/dist/latest-v4.x/docs/api/events.html).

# Usage

## Documentation on ESDoc

The [primary documentation for market-example-contingent is on ESDoc](https://doc.esdoc.org/github.com/DrPaulBrewer/market-example-contingent/)

## Creating Event Handlers

    XMarket.on('trade', function(tradespec){
          // react to trade, do logging, etc.
    });

    XMarket.on('stops', function(t, matches){
           // t is the official time of the order
           // matches is a two element array [nbuystops,nsellstops]
    });

    XMarket.on('order', function(myorder){
           // something to do on every order
    });

    XMarket.on('before-order', function(myorder){
           // something to do on every order before it is processed
    });

The use of arrow functions for event handlers is discouraged.  The market's base class is `EventEmitter` and sets `this` to point at the market instance
when a standard `function` is passed.  

See also the MarketEngine documentation in package `market-engine`, as the market object inherits from MarketEngine.

## Order Format

<pre>
// order = [
// 0      counter: // strictly increasing, may have gaps
// 1      tlocal: // local insertion time   (numeric JS timestamp)
// 2      t: // official time
// 3      tx: // expiration time, in units of official time
// 4      u: user number
// 5      c: // 1 to cancel all active orders by userid
// 6      q: // quantity (could be 0)
// 7      b: // limit order price to buy
// 8      s: // limit order price to sell
// 9      bs: // buy stop.  rising price triggers market order to buy (numeric)
// 10     bsp: // buy stop limit price. buy limit price sent when trade price is greater than or equal to stop
// 11     ss: // sell stop. falling price triggers market order to sell (numeric)
// 12     ssp: // sell stop limit price. sell limit price sent when trade price is less than or equal to stop
// 13     trigb: //  triggers new buy limit order asap
// 14     trigs: //  triggers new sell limit order asap
// 15     trigbs: // triggers new buy stop order asap
// 16     trigbsp: // limit price if triggered buy stop is activated
// 17     trigss: // triggers new sell stop order asap
// 18     trigssp: // limit price if triggered sell stop is activated
// ]
</pre>

## Order Lifecycle

An `order` begins life as 17 element numeric arrays, consisting of elements 2-18 above.

Generally, new orders should be pushed to an array `XMarket.inbox` used as a holding area and processsed in a loop similar to the following:

    while(XMarket.inbox.length)
        XMarket.push(XMarket.inbox.shift());

This is because the execution of orders can trigger other orders, which are pushed to the `.inbox` internally in order
to avoid issues of re-entrancy.  The market procedues are not designed to be reentrant.

When `Xmarket.push(order)` is called, the order is checked in event `before-order` for following various
configurable market rules.  For example, a configuration setting could require an order with a buy price to exceed
the highest active buy price.  Orders that are not rejected are appended to the `active list`, the array `Xmarket.a`.

If the order is not rejected, the order number and local insertion timestamp are prepended as array elements 0 and 1,
and the order is inserted into the active array `XMarket.a` and indexed in relevant order books. There are four order books
which are partial indexes of active buy, sell, buyStop and sellStop orders.

When a matching order arrives from the other side of the market, the matched orders have their order quantities
decremented by the traded quantity and a `trade(tradespec)` event is fired. Other pieces of software that perform
accounting, log trades, or update displays may wish to set a `.on('trade', function(){...})` listener for event `trade`.

After processing and emitting a trade, if any order in the trade has trigger fields, a new order is pushed to the
inbox, transforming the trigger fields to regular order fields and using the old order's quantity traded (not quantity
ordered) as the new quantity.  After creating orders from triggers, stop/stop-limit orders are checked and, if the
stop loss criterion is met, converted into new limit orders.
