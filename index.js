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

var Market = function(options){
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
    this.on('before-order', function(neworder){
	var bpCol = this.o.bpCol, spCol=this.o.spCol, qCol=this.o.qCol, idCol = this.o.idCol, tCol = this.o.tCol;
	var cancelCol = this.o.cancelCol;
	var countRemoved = 0;
	if (neworder[cancelCol]){
	    countRemoved += this.cancel(neworder[idCol]);
	}
	if (neworder[tCol]){
	    countRemoved += this.expire(neworder[tCol]);
	}
	if (countRemoved)
	    this.cleanup();
    });
    this.on('order', function(neworder){
	this.book.buy.syncLast();
	this.book.sell.syncLast();
	this.book.buyStop.syncLast();
	this.book.sellStop.syncLast();
	var trades;
	while ((trades = marketPricing.sequential(this.book.buy.idxdata(),
						  this.book.sell.idxdata(),
						  this.o.countCol,
						  this.o.bpCol,
						  this.o.qCol,
						  this.o.spCol,
						  this.o.qCol))!==undefined){
	    // returns ['b'||'s', prices[], totalQ, buyQ[], sellQ[] ]
	    this.trade({ 
		t: ((trades[0]==='b')? (this.book.buy.idxdata(0)[this.o.tCol]): (this.book.sell.idxdata(0)[this.o.tCol])),
		bs: trades[0],
		prices: trades[1],
		totalQ: trades[2],
		buyQ: trades[3],
		sellQ: trades[4],
		buyA: this.book.buy.idx.slice(0,trades[3].length),
		sellA: this.book.sell.idx.slice(0,trades[4].length)
	    });
	}
    });
    this.on('trade-cleanup', function(tradespec){
	var matches;
	while (Math.max.apply(Math,(matches = this.stopsMatch(tradespec)))>0){
	    this.emit('stops', tradespec.t, matches);
	}
	this.tradeTrigger(tradespec);
	this.cleanup();
    });
    this.on('stops', this.stopsTrigger);
    this.clear();
};


util.inherits(Market, MarketEngine);

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
	    (myorder[trigSliceBegin+3]>0)){
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
    this.book.buy  = new PartialIndex(this.a,this.book.limit,this.o.bpCol,-1,this.o.countCol,1,this.o.qCol,1);
    this.book.sell = new PartialIndex(this.a,this.book.limit,this.o.spCol,1,this.o.countCol,1,this.o.qCol,1);
    this.book.buyStop =  new PartialIndex(this.a,this.book.limit,this.o.bsCol,1,this.o.countCol,1,this.o.qCol,1);
    this.book.sellStop = new PartialIndex(this.a,this.book.limit,this.o.ssCol,-1,this.o.countCol,1,this.o.qCol,1);
    this.books = [this.book.buy,this.book.sell,this.book.buyStop,this.book.sellStop];
    this.inbox = [];
};

Market.prototype.cleanup = function(){
    var blimit = this.book.limit;
    var r = this.emptyTrash();
    function bookRm(b){
	if (r.length < 10){
	    b.remove(r, {shrink:1});
	    if (b.limit < (blimit/2))
		b.scan(blimit);
	} else {
	    b.scan(blimit);
	}
    }
    this.books.forEach(bookRm);
};


Market.prototype.tradeLog = function(tradespec){
    var idCol = this.o.idCol;
    var outFunc = this.o.tradeLogWrite;
    var i,l;
    if (typeof(outFunc)!=='function') return;
    if (tradespec.bs==='b'){
	for(i=0,l=tradespec.sellA.length;i<l;++i)
	    outFunc([
		tradespec.bs,
		tradespec.prices[i],
		tradespec.sellQ[i],
		this.a[tradespec.buyA[0]][idCol],
		this.a[tradespec.sellA[i]][idCol],
		"\n"
	    ].join(","));
    } else if (tradespec.bs==='s'){
	for(i=0,l=tradespec.buyA.length;i<l;++i)
	    outFunc([
		tradespec.bs,
		tradespec.prices[i],
		tradespec.buyQ[i],
		this.a[tradespec.buyA[i]][idCol],
		this.a[tradespec.sellA[0]][idCol],
		"\n"
	    ].join(","));
    }
};



module.exports.Market = Market;


