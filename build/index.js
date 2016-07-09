'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; // Copyright 2016 Paul Brewer, Economic and FInancial Technology Consulting LLC
// This is open source software. The MIT License applies to this software.
// see https://opensource.org/licenses/MIT or included License.md file

// order format
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

var _marketEngine = require('market-engine');

var _marketPricing = require('market-pricing');

var _marketPricing2 = _interopRequireDefault(_marketPricing);

var _partialIndex = require('partial-index');

var _partialIndex2 = _interopRequireDefault(_partialIndex);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// orderHeader is defined for ease of writing a header line for orders to a CSV file or a table heading
var orderHeader = ['count', 'tlocal', 't', 'tx', 'id', 'cancel', 'q', 'buyPrice', 'sellPrice', 'buyStop', 'buyStopPrice', 'sellStop', 'sellStopPrice', 'triggersBuyPrice', 'triggersSellPrice', 'triggersBuyStop', 'triggersBuyStopPrice', 'triggersSellStop', 'triggersSellStopPrice'];

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
    }
    // always report orderHeader fields 0-6, afterward, report only nonzero fields
    for (i = offset; i < l; ++i) {
        if (i <= 6 || ordera[i - offset]) obj[orderHeader[i]] = ordera[i - offset];
    }return obj;
}

function oa(oin) {
    var a = [];
    var i = void 0,
        l = void 0;
    if ((typeof oin === 'undefined' ? 'undefined' : _typeof(oin)) === 'object') {
        for (i = 2, l = orderHeader.length; i < l; ++i) {
            a[i - 2] = oin[orderHeader[i]];
            if (!a[i - 2]) a[i - 2] = 0;
        }
    }
    return a;
}

var Market = function (_MarketEngine) {
    _inherits(Market, _MarketEngine);

    function Market(options) {
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
            trigSliceEnd: 19
        };

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Market).call(this, Object.assign({}, defaults, options)));

        _this.on('bump', _this.cleanup); // update books if orders are bumped off in a bump even
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

    _createClass(Market, [{
        key: 'improvementRule',
        value: function improvementRule(neworder, reject) {
            var bpCol = this.o.bpCol,
                spCol = this.o.spCol;
            // if buyImprove rule in effect, reject buy orders if new order price not above price from book
            if (this.o.buyImprove && neworder[bpCol] && this.book.buy.idx && this.book.buy.idx.length >= this.o.buyImprove && neworder[bpCol] <= this.book.buy.val(this.o.buyImprove - 1)) return reject(neworder);
            // if sellImprove rule in effect, reject sell orders if new order price not below price from book
            if (this.o.sellImprove && neworder[spCol] && this.book.sell.idx && this.book.sell.idx.length >= this.o.sellImprove && neworder[spCol] >= this.book.sell.val(this.o.sellImprove - 1)) return reject(neworder);
        }
    }, {
        key: 'bookSizeRule',
        value: function bookSizeRule() {
            var _this2 = this;

            if (this.o.resetAfterEachTrade) return this.clear();
            var buySellBookLimit = this.o.buySellBookLimit;
            if (buySellBookLimit > 0) {
                (function () {
                    var keep = {};
                    [_this2.book.buy, _this2.book.sell].forEach(function (B) {
                        var i = void 0,
                            l = void 0;
                        for (i = 0, l = Math.min(B.idx.length, buySellBookLimit); i < l; ++i) {
                            keep[B.idx[i]] = 1;
                        }
                    });
                    [_this2.book.buyStop, _this2.book.sellStop].forEach(function (B) {
                        var i = void 0,
                            l = void 0;
                        for (i = 0, l = B.idx.length; i < l; i++) {
                            keep[B.idx[i]] = 1;
                        }
                    });
                    var keepidx = Object.keys(keep).sort(function (a, b) {
                        return +a - b;
                    });
                    var i = void 0,
                        l = void 0,
                        temp = [];
                    for (i = 0, l = keepidx.length; i < l; ++i) {
                        temp[i] = _this2.a[keepidx[i]];
                    }for (i = 0, l = keepidx.length; i < l; ++i) {
                        _this2.a[i] = temp[i];
                    }_this2.a.length = l;
                    _this2.books.forEach(function (B) {
                        B.scan();
                    });
                })();
            }
        }
    }, {
        key: 'currentBidPrice',
        value: function currentBidPrice() {
            // relies on buy book sorted by price first because .val returns primary sort key
            return this.book.buy.val(0);
        }
    }, {
        key: 'currentAskPrice',
        value: function currentAskPrice() {
            // relies on sell book sorted by price first because .val returns primary sort key
            return this.book.sell.val(0);
        }
    }, {
        key: 'lastTradePrice',
        value: function lastTradePrice() {
            if (this.lastTrade && this.lastTrade.prices && this.lastTrade.prices.length) return this.lastTrade.prices[this.lastTrade.prices.length - 1];
        }
    }, {
        key: 'findAndProcessStops',
        value: function findAndProcessStops(tradespec) {
            var matches = void 0;
            for (matches = this.stopsMatch(tradespec); Math.max.apply(Math, _toConsumableArray(matches)) > 0; matches = this.stopsMatch(tradespec)) {
                this.emit('stops', tradespec.t, matches);
            }
        }
    }, {
        key: 'findAndProcessTrades',
        value: function findAndProcessTrades() {
            var seqtrades = void 0;
            var tradeSpec = void 0;
            var i = void 0,
                l = void 0;
            while ((seqtrades = _marketPricing2.default.sequential(this.book.buy.idxdata(), this.book.sell.idxdata(), this.o.countCol, this.o.bpCol, this.o.qCol, this.o.spCol, this.o.qCol)) !== undefined) {
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
                }for (i = 0, l = tradeSpec.sellA.length; i < l; ++i) {
                    tradeSpec.sellId[i] = this.a[tradeSpec.sellA[i]][this.o.idCol];
                }this.trade(tradeSpec);
                this.lastTrade = tradeSpec;
            }
        }
    }, {
        key: 'stopsMatch',
        value: function stopsMatch(tradespec) {
            var prices = tradespec.prices;
            var low = Math.min.apply(Math, _toConsumableArray(prices));
            var high = Math.max.apply(Math, _toConsumableArray(prices));
            return [this.book.buyStop.valBisect(high) || 0, this.book.sellStop.valBisect(low) || 0];
        }
    }, {
        key: 'stopsTrigger',
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
                var _inbox, _trash;

                var bs = this.book.buyStop;
                var newOrders = bs.idxdata().slice(0, matches[0]).map(toBuyAtMarket);
                var trashIdxs = bs.idx.slice(0, matches[0]);
                (_inbox = this.inbox).push.apply(_inbox, _toConsumableArray(newOrders));
                (_trash = this.trash).push.apply(_trash, _toConsumableArray(trashIdxs));
            }
            if (matches[1]) {
                var _inbox2, _trash2;

                var ss = this.book.sellStop;
                var _newOrders = ss.idxdata().slice(0, matches[1]).map(toSellAtMarket);
                var _trashIdxs = ss.idx.slice(0, matches[1]);
                (_inbox2 = this.inbox).push.apply(_inbox2, _toConsumableArray(_newOrders));
                (_trash2 = this.trash).push.apply(_trash2, _toConsumableArray(_trashIdxs));
            }
            this.cleanup();
        }
    }, {
        key: 'triggerOrderToInbox',
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
                    }trigorder[tCol - 2] = t;
                    trigorder[idCol - 2] = myorder[idCol];
                    trigorder[qCol - 2] = q;
                    for (var _ii = 0, _ll = trigSliceEnd - trigSliceBegin; _ii < _ll; ++_ii) {
                        trigorder[bpCol + _ii - 2] = myorder[_ii + trigSliceBegin];
                    }inbox.push(trigorder);
                }
            }
        }
    }, {
        key: 'tradeTrigger',
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
    }, {
        key: 'clear',
        value: function clear() {
            _get(Object.getPrototypeOf(Market.prototype), 'clear', this).call(this); // clears .a
            this.book = {};
            this.book.limit = this.o.booklimit || 100;
            this.book.fixed = this.o.bookfixed;
            this.book.buy = new _partialIndex2.default(this.a, this.book.limit, this.o.bpCol, -1, this.o.countCol, 1, this.o.qCol, 1);
            this.book.sell = new _partialIndex2.default(this.a, this.book.limit, this.o.spCol, 1, this.o.countCol, 1, this.o.qCol, 1);
            this.book.buyStop = new _partialIndex2.default(this.a, this.book.limit, this.o.bsCol, 1, this.o.countCol, 1, this.o.qCol, 1);
            this.book.sellStop = new _partialIndex2.default(this.a, this.book.limit, this.o.ssCol, -1, this.o.countCol, 1, this.o.qCol, 1);
            this.books = [this.book.buy, this.book.sell, this.book.buyStop, this.book.sellStop];
            this.inbox = [];
        }
    }, {
        key: 'cleanup',
        value: function cleanup() {
            var blimit = this.book.limit;
            var bfixed = this.book.fixed;
            var r = this.emptyTrash();
            this.books.forEach(function (b) {
                if (!bfixed && r.length < 10) {
                    b.remove(r, { shrink: 1 });
                    if (b.limit < blimit / 2) b.scan(blimit);
                } else {
                    b.scan(blimit);
                }
            });
        }
    }]);

    return Market;
}(_marketEngine.MarketEngine);

module.exports.orderHeader = orderHeader;
module.exports.oa = oa;
module.exports.ao = ao;
module.exports.Market = Market;
