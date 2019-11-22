"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ao = ao;
exports.oa = oa;
exports.Market = exports.orderHeader = void 0;

var _marketEngine = require("market-engine");

var _marketPricing = _interopRequireDefault(require("market-pricing"));

var _partialIndex = _interopRequireDefault(require("partial-index"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _get(target, property, receiver) { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get; } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(receiver); } return desc.value; }; } return _get(target, property, receiver || target); }

function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/**
 * orderHeader defines the order of fields in an accepted order.  pre-orders start with field 2, the 't' field, as field 0.
 *
 * @type {string[]} orderHeader
 */
var orderHeader = ['count', 'tlocal', 't', 'tx', 'id', 'cancel', 'q', 'buyPrice', 'sellPrice', 'buyStop', 'buyStopPrice', 'sellStop', 'sellStopPrice', 'triggersBuyPrice', 'triggersSellPrice', 'triggersBuyStop', 'triggersBuyStopPrice', 'triggersSellStop', 'triggersSellStopPrice'];
/**
 * convert order from array format to object format using field names from orderHeader
 *
 * @param {number[]} ordera Order in array format, either a 17 number array or a 19 number array.
 * @return {Object} order object with fields from orderHeader
 */

exports.orderHeader = orderHeader;

function ao(ordera) {
  var obj = {};
  var i = 0,
      l = orderHeader.length,
      offset = 0;

  if (ordera.length === orderHeader.length) {
    offset = 0;
  } else if (ordera.length === orderHeader.length - 2) {
    offset = 2;
  } else {
    throw new Error("market-example-contingent function ao(), expected order array to have length 17 or 19, got " + ordera.length);
  } // always report orderHeader fields 0-6, afterward, report only nonzero fields


  for (i = offset; i < l; ++i) {
    if (i <= 6 || ordera[i - offset]) obj[orderHeader[i]] = ordera[i - offset];
  }

  return obj;
}
/**
 * convert order from object format to 17-element pre-order array format
 * @param oin Object format order in, using keys from orderHeader
 * @return {number[]} 17 element pre-order array, suitable for use with .push()
 */


function oa(oin) {
  var a = [];
  var i, l;

  if (_typeof(oin) === 'object') {
    for (i = 2, l = orderHeader.length; i < l; ++i) {
      a[i - 2] = oin[orderHeader[i]];
      if (!a[i - 2]) a[i - 2] = 0;
    }
  }

  return a;
}
/**
 * Market with contingent order features, such as stop orders, one-cancels-other orders and one-sends-other orders
 */


var Market =
/*#__PURE__*/
function (_MarketEngine) {
  _inherits(Market, _MarketEngine);

  /**
   * Market constructor
   *
   * @param {Object} options Options affecting market behavior.  Also passed to marekt-engine constructor.  Accessible later in this.o
   * @param {number} [options.buyImprove] If positive, indicates entry in buy book new buy order must beat to be acceptable. 0=off. 1= new buy must beat book highest buy. 2=must beat 2nd best book,etc.
   * @param {number} [options.sellImprove] If positive, indicates entry in sell book new sell order must beat to be acceptable. 0=off. 1= new sell must be lower than lowest previous sell order on book.
   * @param {boolean} [options.resetAfterEachTrade] If true, calls .clear() after each trade, clearing the market books and active trade list.
   * @param {number} [options.buySellBookLimit] If positive, after each trade keeps at most buySellBookLimit orders in the buy book, and buySellBookLimit orders in the sell book, deleting other orders.
   * @param {boolean} [options.bookfixed=1] If true, books are fixed size and scan active list after each trade. If false, books are accordian-style that can shrink 50% before re-scanning old orders.
   * @param {number} [options.booklimit=100] Indicates maximum and initial size, in orders, of order book for each category (buy,sell,buystop,sellstop).
   * @listens {bump} triggering book update with .cleanup() when orders are bumped off due to cancellation/expiration
   * @listens {before-order} triggering check of .improvementRule() to check new orders against .buyImprove/.sellImprove
   * @listens {order} to detect trades between orders, and when trades are found, calling market-engine inherited .trade() method
   * @listens {trade} triggering one-sends-other orders via .tradeTrigger() to be pushed to .inbox
   * @listens {trade-cleanup} triggering stop orders to .inbox, rescanning order books and applying post-trade book size limits
   * @listens {stops} to push buy/sell orders resulting from stops to .inbox
   */
  function Market(options) {
    var _this;

    _classCallCheck(this, Market);

    // defaults defined standard this.o.tCol, etc. is authoritative for locating particular data in an order
    var defaults = {
      pushArray: 1,
      countCol: 0,
      tlocalCol: 1,
      tCol: 2,
      txCol: 3,
      idCol: 4,
      cancelCol: 5,
      qCol: 6,
      bpCol: 7,
      spCol: 8,
      bsCol: 9,
      bspCol: 10,
      ssCol: 11,
      sspCol: 12,
      trigSliceBegin: 13,
      trigSliceEnd: 19,
      bookfixed: 1,
      booklimit: 100
    };
    _this = _possibleConstructorReturn(this, _getPrototypeOf(Market).call(this, Object.assign({}, defaults, options)));

    _this.on('bump', _this.cleanup); // update books if orders are bumped off in a bump event


    _this.on('before-order', _this.improvementRule);

    _this.on('order', function () {
      // order has already been pushed to .a in MarketEngine.order
      this.book.buy.syncLast();
      this.book.sell.syncLast();
      this.book.buyStop.syncLast();
      this.book.sellStop.syncLast();
      this.findAndProcessTrades();
    });

    _this.on('trade', _this.tradeTrigger);

    _this.on('trade-cleanup', function (tradespec) {
      this.findAndProcessStops(tradespec);
      this.cleanup();
      this.bookSizeRule();
    });

    _this.on('stops', _this.stopsTrigger);

    _this.clear();

    return _this;
  }
  /**
   * submit order to the Market's inbox for eventual processing
   *
   * @param {number[]} neworder a 17 element number array represeting an unentered order.
   * @return {string|undefined} Error message on invalid order format, undefined on ok submission
   */


  _createClass(Market, [{
    key: "submit",
    value: function submit(neworder) {
      if (Array.isArray(neworder) && neworder.length === orderHeader.length - 2) {
        this.inbox.push(neworder);
        return undefined;
      }

      return "market-example-contingent.submit: Invalid order, not an array of the correct length, got:" + JSON.stringify(neworder);
    }
    /**
     * process order from the top of the inbox, returning inbox length
     *
     * @return {number} number of orders remaining in inbox
     */

  }, {
    key: "process",
    value: function process() {
      if (this.inbox.length > 0) this.push(this.inbox.shift());
      return this.inbox.length;
    }
    /**
     * before-order event-handler for enforcing improvementRule.  Note: you would not normally need to explicitly call this method, as the constructor attaches it as a before-order handler.
     *
     * @param {number[]} A pre-order which is a 17 element number array.  Provided by market-engine before-order event handler.
     * @param {function(rejectedOrder:number[])} Function with side-effect of marking orders as rejected.  Provided by market-engine before-order event handler.
     * @private
     */

  }, {
    key: "improvementRule",
    value: function improvementRule(neworder, reject) {
      var bpCol = this.o.bpCol,
          spCol = this.o.spCol; // if buyImprove rule in effect, reject buy orders if new order price not above price from book

      if (this.o.buyImprove && neworder[bpCol] && this.book.buy.idx && this.book.buy.idx.length >= this.o.buyImprove && neworder[bpCol] <= this.book.buy.val(this.o.buyImprove - 1)) return reject(neworder); // if sellImprove rule in effect, reject sell orders if new order price not below price from book

      if (this.o.sellImprove && neworder[spCol] && this.book.sell.idx && this.book.sell.idx.length >= this.o.sellImprove && neworder[spCol] >= this.book.sell.val(this.o.sellImprove - 1)) return reject(neworder);
    }
    /**
     * enforce market reset or book trimming after each trade.  Called automatically by trade-cleanup event handler.
     * @private
     */

  }, {
    key: "bookSizeRule",
    value: function bookSizeRule() {
      if (this.o.resetAfterEachTrade) return this.clear();
      var buySellBookLimit = this.o.buySellBookLimit;

      if (buySellBookLimit > 0) {
        var keep = {};
        [this.book.buy, this.book.sell].forEach(function (B) {
          var i, l;

          for (i = 0, l = Math.min(B.idx.length, buySellBookLimit); i < l; ++i) {
            keep[B.idx[i]] = 1;
          }
        });
        [this.book.buyStop, this.book.sellStop].forEach(function (B) {
          var i, l;

          for (i = 0, l = B.idx.length; i < l; i++) {
            keep[B.idx[i]] = 1;
          }
        });
        var keepidx = Object.keys(keep).sort(function (a, b) {
          return +a - b;
        });
        var i,
            l,
            temp = [];

        for (i = 0, l = keepidx.length; i < l; ++i) {
          temp[i] = this.a[keepidx[i]];
        }

        for (i = 0, l = keepidx.length; i < l; ++i) {
          this.a[i] = temp[i];
        }

        this.a.length = l;
        this.books.forEach(function (B) {
          B.scan();
        });
      }
    }
    /**
     * market current Bid Price
     * @return {number|undefined} price of highest buy limit order from market buy limit order book, if any.
     */

  }, {
    key: "currentBidPrice",
    value: function currentBidPrice() {
      // relies on buy book sorted by price first because .val returns primary sort key
      return this.book.buy.val(0);
    }
    /**
     * market current Ask Price
     * @return {number|undefined} price of lowest sell limit order from market sell limit order book, if any.
     */

  }, {
    key: "currentAskPrice",
    value: function currentAskPrice() {
      // relies on sell book sorted by price first because .val returns primary sort key
      return this.book.sell.val(0);
    }
    /**
     * last trade price, if any.
     * @return {number|undefined}
     */

  }, {
    key: "lastTradePrice",
    value: function lastTradePrice() {
      if (this.lastTrade && this.lastTrade.prices && this.lastTrade.prices.length) return this.lastTrade.prices[this.lastTrade.prices.length - 1];
    }
    /**
     * called automatically in after-trade listener: searches stop books for stop orders and emits stop for stop orders triggered by the trading in parameter tradespec
     * @param {Object} tradespec Trading specification produced from limit order matching.
     * @emits {stops(t, matches)} when a change in trade price should trigger a stop order
     * @private
     */

  }, {
    key: "findAndProcessStops",
    value: function findAndProcessStops(tradespec) {
      var matches;

      for (matches = this.stopsMatch(tradespec); Math.max.apply(Math, _toConsumableArray(matches)) > 0; matches = this.stopsMatch(tradespec)) {
        this.emit('stops', tradespec.t, matches);
      }
    }
    /**
     * called automatically in order listener: determines trades between limit buy orders and limit sell orders, calling market-engine .trade()
     * @private
     */

  }, {
    key: "findAndProcessTrades",
    value: function findAndProcessTrades() {
      var seqtrades;
      var tradeSpec;
      var i, l;

      while ((seqtrades = _marketPricing["default"].sequential(this.book.buy.idxdata(), this.book.sell.idxdata(), this.o.countCol, this.o.bpCol, this.o.qCol, this.o.spCol, this.o.qCol)) !== undefined) {
        // returns seqtrades = ['b'||'s', prices[], totalQ, buyQ[], sellQ[] ]
        tradeSpec = {
          t: seqtrades[0] === 'b' ? this.book.buy.idxdata(0)[this.o.tCol] : this.book.sell.idxdata(0)[this.o.tCol],
          bs: seqtrades[0],
          prices: seqtrades[1],
          totalQ: seqtrades[2],
          buyQ: seqtrades[3],
          sellQ: seqtrades[4],
          buyA: this.book.buy.idx.slice(0, seqtrades[3].length),
          sellA: this.book.sell.idx.slice(0, seqtrades[4].length)
        };
        tradeSpec.buyId = [];
        tradeSpec.sellId = [];

        for (i = 0, l = tradeSpec.buyA.length; i < l; ++i) {
          tradeSpec.buyId[i] = this.a[tradeSpec.buyA[i]][this.o.idCol];
        }

        for (i = 0, l = tradeSpec.sellA.length; i < l; ++i) {
          tradeSpec.sellId[i] = this.a[tradeSpec.sellA[i]][this.o.idCol];
        }

        this.trade(tradeSpec);
        this.lastTrade = tradeSpec;
      }
    }
    /**
     * returns a 2 element array indicating [number of buy-stop, number of sell-stop] that are triggered by the reported trades in parameter tradespec
     * called automatically in stop order scanning
     * @param {Object} tradespec Trade specification
     * @private
     */

  }, {
    key: "stopsMatch",
    value: function stopsMatch(tradespec) {
      var prices = tradespec.prices;
      var low = Math.min.apply(Math, _toConsumableArray(prices));
      var high = Math.max.apply(Math, _toConsumableArray(prices));
      return [this.book.buyStop.valBisect(high) || 0, this.book.sellStop.valBisect(low) || 0];
    }
    /**
     * changes a portion or all of one or more stop orders into limit orders for execution that are pushed into .inbox
     * @param {number} t Effective time.
     * @param {matches} two element array from Market#stopsMatch
     * @private
     */

  }, {
    key: "stopsTrigger",
    value: function stopsTrigger(t, matches) {
      var o = this.o;
      if (!matches) return;

      function toBuyAtMarket(buystop) {
        var neworder = buystop.slice(); // includes triggers in copies, if any

        neworder[o.tCol] = t;
        neworder[o.txCol] = 0;
        neworder[o.cancelCol] = 0;
        neworder[o.bpCol] = neworder[o.bspCol];
        neworder[o.bsCol] = 0;
        neworder[o.bspCol] = 0;
        neworder[o.spCol] = 0;
        neworder[o.ssCol] = 0;
        neworder[o.sspCol] = 0;
        neworder.splice(0, 2);
        return neworder;
      }

      function toSellAtMarket(sellstop) {
        var neworder = sellstop.slice(); // includes triggers in copies, if any

        neworder[o.tCol] = t;
        neworder[o.txCol] = 0;
        neworder[o.cancelCol] = 0;
        neworder[o.bpCol] = 0;
        neworder[o.bsCol] = 0;
        neworder[o.bspCol] = 0;
        neworder[o.spCol] = neworder[o.sspCol];
        neworder[o.ssCol] = 0;
        neworder[o.sspCol] = 0;
        neworder.splice(0, 2);
        return neworder;
      }

      if (matches[0]) {
        var _this$inbox, _this$trash;

        var bs = this.book.buyStop;
        var newOrders = bs.idxdata().slice(0, matches[0]).map(toBuyAtMarket);
        var trashIdxs = bs.idx.slice(0, matches[0]);

        (_this$inbox = this.inbox).push.apply(_this$inbox, _toConsumableArray(newOrders));

        (_this$trash = this.trash).push.apply(_this$trash, _toConsumableArray(trashIdxs));
      }

      if (matches[1]) {
        var _this$inbox2, _this$trash2;

        var ss = this.book.sellStop;

        var _newOrders = ss.idxdata().slice(0, matches[1]).map(toSellAtMarket);

        var _trashIdxs = ss.idx.slice(0, matches[1]);

        (_this$inbox2 = this.inbox).push.apply(_this$inbox2, _toConsumableArray(_newOrders));

        (_this$trash2 = this.trash).push.apply(_this$trash2, _toConsumableArray(_trashIdxs));
      }

      this.cleanup();
    }
    /**
     * Push to .inbox an order triggered by partial or full execution of an OSO one-sends-other
     * i.e. any order with the last 6 fields filled.
     * @param {number} j The OSO order's index in the active list a[]
     * @param {number} q The quantity executed of the OSO order, determining the q of the new order for execution.
     * @param {number} t The effective time
     * @private
     */

  }, {
    key: "triggerOrderToInbox",
    value: function triggerOrderToInbox(j, q, t) {
      if (j === undefined || !q) return;
      var myorder = this.a[j];
      var o = this.o;
      var qCol = o.qCol;
      var bpCol = o.bpCol;
      var tCol = o.tCol;
      var idCol = o.idCol;
      var trigSliceBegin = o.trigSliceBegin;
      var trigSliceEnd = o.trigSliceEnd;
      var inbox = this.inbox;

      if (myorder && myorder[qCol] >= q) {
        if (myorder[trigSliceBegin] > 0 || myorder[trigSliceBegin + 1] > 0 || myorder[trigSliceBegin + 2] > 0 || myorder[trigSliceBegin + 3] > 0 || myorder[trigSliceBegin + 4] > 0 || myorder[trigSliceBegin + 5] > 0) {
          var trigorder = [];

          for (var ii = 0, ll = trigSliceEnd - 2; ii < ll; ++ii) {
            trigorder[ii] = 0;
          }

          trigorder[tCol - 2] = t;
          trigorder[idCol - 2] = myorder[idCol];
          trigorder[qCol - 2] = q;

          for (var _ii = 0, _ll = trigSliceEnd - trigSliceBegin; _ii < _ll; ++_ii) {
            trigorder[bpCol + _ii - 2] = myorder[_ii + trigSliceBegin];
          }

          inbox.push(trigorder);
        }
      }
    }
    /**
     * Push to .inbox any orders triggered by OSO orders involved in trades in parameter tradespec.
     * Called automatically by trade listener set up in constructor
     * @param {Object} tradespec Trade specification
     * @private
     */

  }, {
    key: "tradeTrigger",
    value: function tradeTrigger(tradespec) {
      var t = tradespec.t;
      var buyA = tradespec.buyA,
          sellA = tradespec.sellA;
      var buyQ = tradespec.buyQ,
          sellQ = tradespec.sellQ;
      if (buyA) for (var i = 0, l = buyA.length; i < l; ++i) {
        this.triggerOrderToInbox(buyA[i], buyQ[i], t);
      }
      if (sellA) for (var _i = 0, _l = sellA.length; _i < _l; ++_i) {
        this.triggerOrderToInbox(sellA[_i], sellQ[_i], t);
      }
    }
    /**
     * clears or resets market to initial "new" condition, clearing active list, books, and trash
     */

  }, {
    key: "clear",
    value: function clear() {
      _get(_getPrototypeOf(Market.prototype), "clear", this).call(this); // clears .a and .trash

      /**
       * container for books and book settings
       * @type {Object} this.book
       */


      this.book = {};
      /**
       * upper limit for book size
       * @type {number} this.book.limit
       */

      this.book.limit = this.o.booklimit || 100;
      /**
       * indicator that book is fixed-size (true) or accordian (false)
       * @type {boolean} this.book.fixed
       */

      this.book.fixed = this.o.bookfixed;
      /**
       * buy order book provided by PartialIndex
       * @type {Object} this.book.buy
       */

      this.book.buy = new _partialIndex["default"](this.a, this.book.limit, this.o.bpCol, -1, this.o.countCol, 1, this.o.qCol, 1);
      /**
       * sell order book provided by PartialIndex
       * @type {Object} this.book.sell
       */

      this.book.sell = new _partialIndex["default"](this.a, this.book.limit, this.o.spCol, 1, this.o.countCol, 1, this.o.qCol, 1);
      /**
       * buyStop order book provided by PartialIndex
       * @type {Object} this.book.buyStop
       */

      this.book.buyStop = new _partialIndex["default"](this.a, this.book.limit, this.o.bsCol, 1, this.o.countCol, 1, this.o.qCol, 1);
      /**
       * sellStop order book provided by PartialIndex
       * @type {Object} this.book.sellStop
       */

      this.book.sellStop = new _partialIndex["default"](this.a, this.book.limit, this.o.ssCol, -1, this.o.countCol, 1, this.o.qCol, 1);
      /**
       * list of all books
       * @type {Array<Object>} this.books
       */

      this.books = [this.book.buy, this.book.sell, this.book.buyStop, this.book.sellStop];
      /**
       * inbox for pre-orders from internal processes such as stops and triggers. new orders should also be pushed here.
       * @type {Array<number[]>} this.inbox
       */

      this.inbox = [];
    }
    /**
     * empties trashed orders from book lists and scans active list to refill books.  
     * Called by other methods as needed.  You probably won't need to call this function, unless implementing new functionality that affects the books or trashes orders.
     * @private
     */

  }, {
    key: "cleanup",
    value: function cleanup() {
      var blimit = this.book.limit;
      var bfixed = this.book.fixed;
      var r = this.emptyTrash();
      this.books.forEach(function (b) {
        if (!bfixed && r.length < 10) {
          b.remove(r, {
            shrink: 1
          });
          if (b.limit < blimit / 2) b.scan(blimit);
        } else {
          b.scan(blimit);
        }
      });
    }
  }]);

  return Market;
}(_marketEngine.MarketEngine);

exports.Market = Market;
