market-example-contingent
===
[![Build Status](https://travis-ci.org/DrPaulBrewer/market-example-contingent.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/market-example-contingent)
[![Coverage Status](https://coveralls.io/repos/github/DrPaulBrewer/market-example-contingent/badge.svg?branch=master)](https://coveralls.io/github/DrPaulBrewer/market-example-contingent?branch=master)

### Provides exchange Market with time-based and cancellable limit orders, and contingent orders such as stop, OSO (one-sends-others) and OCO (one-cancels-others)

Built using market-engine, market-pricing, and partial-index packages also posted on npm

### Warning: versions less than 1.0.0 are pre-release/experimental, may be subject to massive change without notice or not work 

##Installation

    npm install market-example-contingent --save

##Initialization

    var Market  = require('market-example-contingent').Market;
    var XMarket = new Market({});

##Creating Event Handlers
   
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

##Order Lifecycle

