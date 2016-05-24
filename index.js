// Copyright 2016 Paul Brewer, Economic and FInancial Technology Consulting LLC 
// This is open source software. The MIT License applies to this software.
// see https://opensource.org/licenses/MIT or included License.md file


/* jshint node:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

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

const util = require('util');
const MarketEngine = require('market-engine');
const marketPricing = require('market-pricing');
const PartialIndex = require('partial-index');

// orderHeader is defined for ease of writing a header line for orders to a CSV file or a table heading
var orderHeader = [
    'count',
    'tlocal',
    't',
    'tx',
    'id',
    'cancel',
    'q',
    'buyPrice',
    'sellPrice',
    'buyStop',
    'buyStopPrice',
    'sellStop',
    'sellStopPrice',
    'triggersBuyPrice',
    'triggersSellPrice',
    'triggersBuyStop',
    'triggersBuyStopPrice',
    'triggersSellStop',
    'triggersSellStopPrice'
];

var ao = function(ordera){
    var obj = {};
    var i=0,l=orderHeader.length,offset=0;
    if (ordera.length===orderHeader.length){
	offset=0;
    } else if (ordera.length===(orderHeader.length-2)){
	offset=2;
    } else {
	throw new Error("market-example-contingent function ao(), expected order array to have length 17 or 19, got "+oa.length);
    }
    // always report orderHeader fields 0-6, afterward, report only nonzero fields
    for(i=offset;i<l;++i)
	if ((i<=6) || (ordera[i-offset]))
	    obj[orderHeader[i]] = ordera[i-offset];
    return obj;
};

var oa = function(oin){
    var a = [];
    var i,l;
    if (typeof(oin)==='object'){
	for(i=2,l=orderHeader.length;i<l;++i){
	    a[i-2] = oin[orderHeader[i]];
	    if (!a[i-2]) a[i-2] = 0;
	}
    }  
    return a;	
};



var Market = function(options){
    // defaults defined standard this.o.tCol, etc. is authoritative for locating particular data in an order
    var defaults = { 
	pushArray:1,
	countCol:0,
	tlocalCol:1,
	tCol:2,
	txCol:3,
	idCol:4,
	cancelCol:5,
	qCol:6,
	bpCol:7,
	spCol:8,
	bsCol:9,
	bspCol:10,
	ssCol:11,
	sspCol:12,
	trigSliceBegin:13,
	trigSliceEnd:19
    };
    MarketEngine.call(this, Object.assign({}, defaults, options));
    /* update books if orders are bumped off in a bump event */
    this.on('bump', this.cleanup);
    this.on('before-order', function(neworder, reject){
	var bpCol = this.o.bpCol, spCol=this.o.spCol, qCol=this.o.qCol, idCol = this.o.idCol, tCol = this.o.tCol;
	var cancelCol = this.o.cancelCol;
	var countRemoved = 0;
	// if buyImprove rule in effect, reject buy orders if new order price not above price from book
	if ( (this.o.buyImprove && neworder[bpCol]) &&
	     (this.book.buy.idx) && 
	     (this.book.buy.idx.length > this.o.buyImprove.level)
	   ){
	    if (neworder[bpCol] <= this.book.buy.val(this.o.buyImprove.level))
		return reject(neworder);
	}
	// if sellImprove rule in effect, reject sell orders if new order price not below price from book
	if ( (this.o.sellImprove && neworder[spCol]) &&
	     (this.book.sell.idx) && 
	     (this.book.sell.idx.length > this.o.sellImprove.level) 
	   ) {
	    if (neworder[spCol] >= this.book.sell.val(this.o.sellImprove.level))
		return reject(neworder);
	}
    });
    this.on('order', function(neworder){
	this.book.buy.syncLast();
	this.book.sell.syncLast();
	this.book.buyStop.syncLast();
	this.book.sellStop.syncLast();
	this.findAndProcessTrades();
    });
    this.on('trade', this.tradeTrigger);
    this.on('trade-cleanup', function(tradespec){
	this.findAndProcessStops(tradespec);
    });
    this.on('trade-cleanup', this.cleanup);
    var buySellBookLimit = this.o.buySellBookLimit;
    if (buySellBookLimit){
	this.on('trade-cleanup', function(){
	    var keep = {};
	    [this.book.buy,this.book.sell].forEach(function(B){
		var i,l;
		for(i=0,l=Math.min(B.idx.length,buySellBookLimit);i<l;++i)
		    keep[B.idx[i]] = 1;
	    });
	    [this.book.buyStop,this.book.sellStop].forEach(function(B){
		var i,l;
		for(i=0,l=B.idx.length;i<l;i++)
		    keep[B.idx[i]] = 1;
	    });
	    var keepidx = Object.keys(keep).sort(function(a,b){ return +a-b; });
	    var i,l,temp=[];
	    for(i=0,l=keepidx.length;i<l;++i)
		temp[i] = this.a[keepidx[i]];
	    for(i=0,l=keepidx.length;i<l;++i)
		this.a[i] = temp[i];
	    this.a.length = l;
	    this.books.forEach(function(B){ B.scan(); });
	});
    }
    if (this.o.resetAfterEachTrade){
	this.on('trade-cleanup', function(){
	    this.a.length = 0;
	    this.books.forEach(function(B){ B.scan(); });
	});
    }
    this.on('stops', this.stopsTrigger);
    this.clear();
};


util.inherits(Market, MarketEngine);

Market.prototype.findAndProcessStops = function (tradespec){
    var matches;
    while (Math.max.apply(Math,(matches = this.stopsMatch(tradespec)))>0){
	this.emit('stops', tradespec.t, matches);
    }
};

Market.prototype.findAndProcessTrades = function(){
    var seqtrades;
    var tradeSpec;
    var i,l;
    while ((seqtrades = marketPricing.sequential(this.book.buy.idxdata(),
						 this.book.sell.idxdata(),
						 this.o.countCol,
						 this.o.bpCol,
						 this.o.qCol,
						 this.o.spCol,
						 this.o.qCol))!==undefined){
	// returns seqtrades = ['b'||'s', prices[], totalQ, buyQ[], sellQ[] ]	    
	tradeSpec = { 
	    t: ((seqtrades[0]==='b')? (this.book.buy.idxdata(0)[this.o.tCol]): (this.book.sell.idxdata(0)[this.o.tCol])),
	    bs: seqtrades[0],
	    prices: seqtrades[1],
	    totalQ: seqtrades[2],
	    buyQ: seqtrades[3],
	    sellQ: seqtrades[4],
	    buyA: this.book.buy.idx.slice(0,seqtrades[3].length),
	    sellA: this.book.sell.idx.slice(0,seqtrades[4].length)
	};
	tradeSpec.buyId  = [];
	tradeSpec.sellId = [];
	for(i=0,l=tradeSpec.buyA.length;i<l;++i)
	    tradeSpec.buyId[i] = this.a[tradeSpec.buyA[i]][this.o.idCol];
	for(i=0,l=tradeSpec.sellA.length;i<l;++i)
	    tradeSpec.sellId[i] = this.a[tradeSpec.sellA[i]][this.o.idCol];
	this.trade(tradeSpec);
    }
};

Market.prototype.stopsMatch = function(tradespec){
    var prices = tradespec.prices;
    var low  = Math.min.apply(Math, prices);
    var high = Math.max.apply(Math, prices);
    return [
	( this.book.buyStop.valBisect(high) || 0), 
	( this.book.sellStop.valBisect(low) || 0)
    ];
};

Market.prototype.stopsTrigger = function(t, matches){
    var o = this.o;    
    if (!matches) return;
    function toBuyAtMarket(buystop){
	var neworder = [];
	neworder = buystop.slice();  //includes triggers in copies, if any
	neworder[o.tCol] = t;
	neworder[o.txCol] = 0;
	neworder[o.cancelCol] = 0;
	neworder[o.bpCol] = neworder[o.bspCol];
	neworder[o.bsCol] = 0;
	neworder[o.bspCol] = 0;
	neworder[o.spCol] = 0;
	neworder[o.ssCol] = 0;
	neworder[o.sspCol] = 0;
	neworder.splice(0,2);
	return neworder;
    }
    function toSellAtMarket(sellstop){
	var neworder = [];
	neworder = sellstop.slice(); //includes triggers in copies, if any
	neworder[o.tCol] = t;
	neworder[o.txCol] = 0;
	neworder[o.cancelCol] = 0;
	neworder[o.bpCol] = 0; 
	neworder[o.bsCol] = 0;
	neworder[o.bspCol] = 0;
	neworder[o.spCol] = neworder[o.sspCol];
	neworder[o.ssCol] = 0;
	neworder[o.sspCol] = 0;
	neworder.splice(0,2);
	return neworder;
    }
    if (matches[0]){
	this.inbox.push.apply(this.inbox, this.book.buyStop.idxdata().slice(0,matches[0]).map(toBuyAtMarket));
	this.trash.push.apply(this.trash, this.book.buyStop.idx.slice(0,matches[0]));	
    }
    if (matches[1]){
	this.inbox.push.apply(this.inbox, this.book.sellStop.idxdata().slice(0,matches[1]).map(toSellAtMarket));
	this.trash.push.apply(this.trash, this.book.sellStop.idx.slice(0,matches[1]));
    }
    this.cleanup();
};

Market.prototype.triggerOrderToInbox = function(j,q,t){
    if ((j===undefined) || (!q)) return;
    var myorder = this.a[j];
    var trigorder = [];
    var o = this.o;
    var qCol = o.qCol;
    var bpCol = o.bpCol;
    var tCol = o.tCol;
    var idCol = o.idCol;
    var trigSliceBegin = o.trigSliceBegin;
    var trigSliceEnd = o.trigSliceEnd;
    var inbox = this.inbox;
    var ii,ll;
    if (myorder && (myorder[qCol]>=q)){
	if ((myorder[trigSliceBegin]>0) ||
	    (myorder[trigSliceBegin+1]>0) ||
	    (myorder[trigSliceBegin+2]>0) ||
	    (myorder[trigSliceBegin+3]>0) ||
	    (myorder[trigSliceBegin+4]>0) ||
	    (myorder[trigSliceBegin+5]>0)){
	    trigorder = [];
	    for(ii=0,ll=trigSliceEnd-2;ii<ll;++ii)
		trigorder[ii] = 0;
	    trigorder[tCol-2] = t;
	    trigorder[idCol-2] = myorder[idCol];
	    trigorder[qCol-2] = q;
	    for(ii=0,ll=trigSliceEnd-trigSliceBegin;ii<ll;++ii)
		trigorder[bpCol+ii-2] = myorder[ii+trigSliceBegin]; 
	    inbox.push(trigorder);
	}
    } 
};

Market.prototype.tradeTrigger = function(tradespec){
    var i,l;
    var t = tradespec.t;
    var buyA = tradespec.buyA, sellA=tradespec.sellA;
    var buyQ = tradespec.buyQ, sellQ=tradespec.sellQ;
    if (buyA)
	for(i=0,l=buyA.length;i<l;++i){
	    this.triggerOrderToInbox(buyA[i],buyQ[i],t);
	}
    if (sellA)
	for(i=0,l=sellA.length;i<l;++i){
	    this.triggerOrderToInbox(sellA[i],sellQ[i],t);
	}
};

Market.prototype.clear = function(){
    MarketEngine.prototype.clear.call(this);
    this.book = {};
    this.book.limit = this.o.booklimit || 100;
    this.book.fixed = this.o.bookfixed;
    this.book.buy  = new PartialIndex(this.a,this.book.limit,this.o.bpCol,-1,this.o.countCol,1,this.o.qCol,1);
    this.book.sell = new PartialIndex(this.a,this.book.limit,this.o.spCol,1,this.o.countCol,1,this.o.qCol,1);
    this.book.buyStop =  new PartialIndex(this.a,this.book.limit,this.o.bsCol,1,this.o.countCol,1,this.o.qCol,1);
    this.book.sellStop = new PartialIndex(this.a,this.book.limit,this.o.ssCol,-1,this.o.countCol,1,this.o.qCol,1);
    this.books = [this.book.buy,this.book.sell,this.book.buyStop,this.book.sellStop];
    this.inbox = [];
};

Market.prototype.cleanup = function(){
    var blimit = this.book.limit;
    var bfixed = this.book.fixed;
    var r = this.emptyTrash();
    this.books.forEach(function (b){
	if ((!bfixed) && (r.length < 10)){
	    b.remove(r, {shrink:1});
	    if (b.limit < (blimit/2))
		b.scan(blimit);
	} else {
	    b.scan(blimit);
	}
    });
};

module.exports.orderHeader = orderHeader;
module.exports.oa = oa;
module.exports.ao = ao;
module.exports.Market = Market;


