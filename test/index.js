const assert = require('assert');
const should = require('should');
const marketExampleContingent = require('../index.js');
const Market = marketExampleContingent.Market;
const orderHeader = marketExampleContingent.orderHeader;
const oa = marketExampleContingent.oa;
const ao = marketExampleContingent.ao;
const orders = require('./orders.js');

function process(M,orders){
   orders.forEach(function(myorder){
       if (!myorder)
	   throw new Error("check test orders input to process(): order undefined");
       M.inbox.push(myorder);
       while (M.inbox.length>0)
	   M.push(M.inbox.shift());
   });
}

function omit2(a){
    return a.slice(2);
}

describe('orderHeader', function(){
    it('should be an Array', function(){
	assert.ok(Array.isArray(orderHeader));
    });
    it('should have 19 elements', function(){
	assert.equal(orderHeader.length, 19);
    });
});

describe('oa', function(){
    it('should be a function', function(){
	oa.should.be.type('function');
    });
    it('oa({}) should return a 17 element array of zeroes', function(){
	oa({}).should.deepEqual([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
    });
    it('oa({q:3, buyPrice: 100}) should return [0,0,0,0,3,100,0,...,0]', function(){
	oa({q:3, buyPrice:100}).should.deepEqual([0,0,0,0,3,100,0,0,0,0,0,0,0,0,0,0,0]);
    });
});

describe('ao', function(){
    it('should be a function', function(){
	ao.should.be.type('function');
    });
    it('ao(Array of length 17 [0,0,3,100,0,...,0]) should return obj.q==3, obj.buyPrice==100', function(){
	var o = ao([0,0,0,0,3,100,0,0,0,0,0,0,0,0,0,0,0]);
	o.q.should.equal(3);
	o.buyPrice.should.equal(100);
    });
    it('ao(Array of length 19 [0,0,0,0,3,100,0,...,0]) should return obj.q==3, obj.buyPrice==100', function(){
	var o = ao([0,0,0,0,0,0,3,100,0,0,0,0,0,0,0,0,0,0,0]);
	o.q.should.equal(3);
	o.buyPrice.should.equal(100);
    });
    it('ao(Array of length 18) should throw an error', function(){
	var o18 = new Array(18).fill(1);
	(function(){ ao(o18) }).should.throw();
    });
    it('ao() (missing parameter) should throw an error', function(){
	ao.should.throw();
    });
    it('ao({}) (bad parameter) should throw an error', function(){
	(function(){ ao({}) }).should.throw();
    });
});
	
describe('Market(options={})', function(){
    it('should be a function', function(){
	Market.should.be.type('function');
    });

    function initOK(AM){
	AM.should.have.properties(['a','inbox','trash','book','books','o']);
	AM.a.should.deepEqual([]);
	AM.inbox.should.deepEqual([]);
	AM.trash.should.deepEqual([]);
	AM.book.should.have.properties(['buy','sell','buyStop','sellStop']);
	assert.ok(AM.books.length===4);
	assert.ok(AM.books[0]===AM.book.buy);
	assert.ok(AM.books[1]===AM.book.sell);
	assert.ok(AM.books[2]===AM.book.buyStop);
	assert.ok(AM.books[3]===AM.book.sellStop);
	[AM.o.countCol,
	 AM.o.tlocalCol,
	 AM.o.tCol,
	 AM.o.txCol,
	 AM.o.idCol,
	 AM.o.cancelCol,
	 AM.o.qCol,
	 AM.o.bpCol,
	 AM.o.spCol,
	 AM.o.bsCol,
	 AM.o.bspCol,
	 AM.o.ssCol,
	 AM.o.sspCol,
	 AM.o.trigSliceBegin,
	 AM.o.trigSliceEnd].should.deepEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13,19]);
    }

    it('should initialize correctly', function(){
	var AM = new Market({});
	initOK(AM);
    });
    
    it('should clear correctly', function(){
	var AM = new Market({});
	AM.a.push([1,2,3]);
	AM.a.push([4,5,6]);
	AM.inbox.push([7,8,9]);
	AM.trash.push([2,3,4,5,6]);
	AM.clear();
	initOK(AM);
    });

    describe('buy price less than sell price', function(){
	var AM1 = new Market({});
	var AM2 = new Market({});
	var trades = [];
	[AM1,AM2].forEach(function(M){
	    M.on('trade', function(tradespec){
		trades.push(tradespec);
	    });
	});
	process(AM1,[
	    orders.id1_buy_1_at_100,
	    orders.id2_sell_1_at_105
	]);
	process(AM2,[
	    orders.id2_sell_1_at_105,
	    orders.id1_buy_1_at_100
	]);
	it('should not generate a trade', function(){
	    assert.ok(trades.length===0);
	});
	it('should have correct buy book', function(){
	    AM1.book.buy.idxdata().map(omit2).should.eql([orders.id1_buy_1_at_100]);
	    AM2.book.buy.idxdata().map(omit2).should.eql([orders.id1_buy_1_at_100]);
	});
	it('should have correct sell book', function(){
	    AM1.book.sell.idxdata().map(omit2).should.eql([orders.id2_sell_1_at_105]);
	    AM2.book.sell.idxdata().map(omit2).should.eql([orders.id2_sell_1_at_105]);
	});
	it('should have empty stop books', function(){
	    assert.ok(AM1.book.buyStop.idx.length===0);
	    assert.ok(AM1.book.sellStop.idx.length===0);
	    assert.ok(AM2.book.buyStop.idx.length===0);
	    assert.ok(AM2.book.sellStop.idx.length===0);
	});
    });

    describe('higher buy price accepting preceding lower sell price', function(){
	var scenario = [
	    orders.id2_sell_1_at_125,
	    orders.id1_buy_1_at_100,
	    orders.id2_sell_1_at_105,
	    orders.id1_buy_1_at_110
	];
	var AM = new Market({});
	var trades=[];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	process(AM, scenario);
	it('should generate a trade', function(){
	    assert.ok(trades.length>0);
	});
	it('should generate the correct trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 'b',
		prices: [105],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [3],
		sellA: [2]
	    });
	});
	it('should remove filled orders from active list .a ', function(){
	    assert.ok(AM.a.length===2);
	});
	it('should have correct post-trade buy book', function(){
	    assert.ok(AM.book.buy.idx.length===1);
	    assert.ok(AM.book.buy.idx[0]===1);
	    omit2(AM.a[1]).should.deepEqual(orders.id1_buy_1_at_100);
	});
	it('should have correct post-trade sell book', function(){
	    assert.ok(AM.book.sell.idx.length===1);
	    assert.ok(AM.book.sell.idx[0]===0);
	    omit2(AM.a[0]).should.deepEqual(orders.id2_sell_1_at_125);
	});
	it('should have empty stop books', function(){
	    assert.ok(AM.book.buyStop.idx.length===0);
	    assert.ok(AM.book.sellStop.idx.length===0);
	});
    });


    describe('lower sell price accepting preceding higher buy price', function(){
	var scenario = [
	    orders.id2_sell_1_at_125,
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	    orders.id2_sell_1_at_105
	];
	var AM = new Market({});
	var trades=[];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	process(AM, scenario);
	it('should generate a trade', function(){
	    assert.ok(trades.length>0);
	});
	it('should generate the correct trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [2],
		sellA: [3]		
	    });
	});
	it('should remove filled orders from active list .a ', function(){
	    assert.ok(AM.a.length===2);
	});
	it('should have correct post-trade buy book', function(){
	    assert.ok(AM.book.buy.idx.length===1);
	    assert.ok(AM.book.buy.idx[0]===1);
	    omit2(AM.a[1]).should.deepEqual(orders.id1_buy_1_at_110);
	});
	it('should have correct post-trade sell book', function(){
	    assert.ok(AM.book.sell.idx.length===1);
	    assert.ok(AM.book.sell.idx[0]===0);
	    omit2(AM.a[0]).should.deepEqual(orders.id2_sell_1_at_125);
	});
	it('should have empty stop books', function(){
	    assert.ok(AM.book.buyStop.idx.length===0);
	    assert.ok(AM.book.sellStop.idx.length===0);
	});
    });

   
    describe('buy 1@120, sell stop 1@112', function(){
	var scenario = [
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112
	];
	var AM = new Market({});
	var trades=[];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	process(AM, scenario);
	it('should not generate a trade', function(){
	    assert.ok(trades.length===0);
	});
	it('should have buy book with 1 item', function(){
	    assert.ok(AM.book.buy.idx.length === 1);
	});
	it('should have empty sell book', function(){
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have emoty buyStop book', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	});
	it('should have sellStop book with unexecuted order', function(){
	    assert.ok(AM.book.sellStop.idx.length === 1);
	    AM.book.sellStop.idx.should.eql([1]);
	    omit2(AM.book.sellStop.idxdata(0)).should.deepEqual(orders.id3_sellstop_1_at_112);
	});
    });


    describe('buy 1@120, sell stop 1@112, sell 1@115', function(){
	var scenario = [
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112,
	    orders.id2_sell_1_at_115
	];
	var AM = new Market({});
	var trades=[];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	process(AM, scenario);
	it('should generate a trade', function(){
	    assert.ok(trades.length===1);
	});
	it('should generate the correct trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [0],
		sellA: [2]		
	    });
	});
	it('should have empty buy and sell books', function(){
	    assert.ok(AM.book.buy.idx.length === 0);
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have sellStop book with unexecuted order', function(){
	    assert.ok(AM.book.sellStop.idx.length === 1);
	    AM.book.sellStop.idx.should.eql([0]);
	    omit2(AM.book.sellStop.idxdata(0)).should.eql(orders.id3_sellstop_1_at_112);
	});
	describe(' .stopsMatch() ', function(){
	    it('should return [0,1] for {prices: [110]}', function(){
		AM.stopsMatch({prices:[110]}).should.deepEqual([0,1]);
	    });
	    it('should return [0,1] for {prices: [112]}', function(){
		AM.stopsMatch({prices:[112]}).should.deepEqual([0,1]);
	    });
	    it('should return [0,0] for {prices: [115]} ', function(){
		AM.stopsMatch({prices:[115]}).should.deepEqual([0,0]);
	    });
	    it('should return [0,1] fpr {prices:[110,115]', function(){
		AM.stopsMatch({prices:[110,115]}).should.deepEqual([0,1]);
	    });
	});
    });
	
    describe('sell 1@105, buy stop 1@112, buy 1@110', function(){
	var scenario = [
	    orders.id2_sell_1_at_105,
	    orders.id3_buystop_1_at_112,
	    orders.id1_buy_1_at_110
	];
	var AM = new Market({});
	var trades=[];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	process(AM, scenario);
	it('should generate a trade', function(){
	    assert.ok(trades.length===1);
	});
	it('should generate the correct trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 'b',
		prices: [105],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [2],
		sellA: [0]		
	    });
	});
	it('should have empty buy and sell books', function(){
	    assert.ok(AM.book.buy.idx.length === 0);
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have buyStop book with unexecuted order', function(){
	    assert.ok(AM.book.buyStop.idx.length === 1);
	    AM.book.buyStop.idx.should.eql([0]);
	    omit2(AM.book.buyStop.idxdata(0)).should.eql(orders.id3_buystop_1_at_112);
	});
	describe(' .stopsMatch() ', function(){
	    it('should return [0,0] for {prices: [110]}', function(){
		AM.stopsMatch({prices:[110]}).should.deepEqual([0,0]);
	    });
	    it('should return [1,0] for {prices: [112]}', function(){
		AM.stopsMatch({prices:[112]}).should.deepEqual([1,0]);
	    });
	    it('should return [1,0] for {prices: [115]} ', function(){
		AM.stopsMatch({prices:[115]}).should.deepEqual([1,0]);
	    });
	    it('should return [1,0] fpr {prices:[110,115]', function(){
		AM.stopsMatch({prices:[110,115]}).should.deepEqual([1,0]);
	    });
	});
    });
    
    describe('buy 1@100, 1@110,1@120, sell stop 1@112, sell 1@115, sell 1@105', function(){
	var scenario = [
	    orders.id1_buy_1_at_100,
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112,
	    orders.id2_sell_1_at_115,
	    orders.id2_sell_1_at_105
	];
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.equal(AM.inbox.length, 0);
	});
	it('should execute a stop-loss', function(){
	    assert.equal(stops.length, 1);
	});
	it('should generate 3 trades', function(){
	    assert.equal(trades.length, 3);
	});
	it('should generate the correct first trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		buyId: [1],
		sellId: [2],
		sellQ: [1],
		buyA: [2],
		sellA: [4]		
	    });
	});
	it('should generate the correct second trade', function(){
	    trades[1].should.deepEqual({
		t:0,
		bs: 's',
		prices: [110],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [1],
		sellA: [3]
	    });
	});
	it('should generate the correct third trade', function(){
	    trades[2].should.deepEqual({
		t:0,
		bs: 's',
		prices: [100],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [3],
		buyA: [0],
		sellA: [1]		
	    });
	});
	it('should have empty buy and sell books', function(){
	    assert.ok(AM.book.buy.idx.length === 0);
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have empty buyStop and sellStop books', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	    assert.ok(AM.book.sellStop.idx.length === 0);
	});
    });


    describe('sell 1@115, 1@125, 1@105, buy stop 1@112, buy 1@110, 1@120 ', function(){
	var scenario = [
	    orders.id2_sell_1_at_115,
	    orders.id2_sell_1_at_125,
	    orders.id2_sell_1_at_105,
	    orders.id3_buystop_1_at_112,
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	];
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.equal(AM.inbox.length, 0);
	});
	it('should execute a stop-loss', function(){
	    assert.equal(stops.length, 1);
	});
	it('should generate 3 trades', function(){
	    assert.equal(trades.length, 3);
	});
	it('should generate the correct first trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 'b',
		prices: [105],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [4],
		sellA: [2]		
	    });
	});
	it('should generate the correct second trade', function(){
	    trades[1].should.deepEqual({
		t:0,
		bs: 'b',
		prices: [115],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [3],
		sellA: [0]
	    });
	});
	it('should generate the correct third trade', function(){
	    trades[2].should.deepEqual({
		t:0,
		bs: 'b',
		prices: [125],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [3],
		sellId: [2],
		buyA: [1],
		sellA: [0]		
	    });
	});
	it('should have empty buy and sell books', function(){
	    assert.ok(AM.book.buy.idx.length === 0);
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have empty buyStop and sellStop books', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	    assert.ok(AM.book.sellStop.idx.length === 0);
	});
    });

    describe('300 buy 1@100, 1@110,1@120, sell stop 1@112, sell stop 250@112, sell 1@115, sell 1@105', function(){
	var scenario=[];
	var i,l;
	for(i=0,l=300;i<l;++i)
	    scenario.push(orders.id1_buy_1_at_100.slice());
	scenario.push.apply(scenario, [
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112,
	    orders.id3_sellstop_250_at_112,
	    orders.id2_sell_1_at_115,
	    orders.id2_sell_1_at_105
	]);
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.equal(AM.inbox.length, 0);
	});
	it('should execute a stop-loss', function(){
	    assert.ok(stops.length>0);
	});
	it('should generate a match against stop books of [0,2]', function(){
	    stops.should.deepEqual([[0,2]]);
	});
	it('should generate 6 trades', function(){
	    // each book.limit===100 matches will appear in a separate trade
	    assert.equal(trades.length, 6);
	});
	it('should generate the correct first trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [301],
		sellA: [304]		
	    });
	});
	it('should generate the correct second trade', function(){
	    trades[1].should.deepEqual({
		t:0,
		bs: 's',
		prices: [110],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [300],
		sellA: [303]
	    });
	});
	it('should generate the correct third trade', function(){
	    trades[2].should.deepEqual({
		t:0,
		bs: 's',
		prices: [100],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [3],
		buyA: [0],
		sellA: [300]		
	    });
	});
	it('should generate the correct fourth trade', function(){
	    var i;
	    var myBuyA = [];
	    for(i=0;i<97;++i){ 
		myBuyA[i]=i;
	    }
	    trades[3].should.deepEqual({
		t:0,
		bs: 's',
		prices: (new Array(97).fill(100)),
		totalQ: 97,
		buyQ: (new Array(97).fill(1)),
		sellQ: [97],
		buyId: (new Array(97).fill(1)),
		sellId: [3],
		buyA: myBuyA,
		sellA: [299]
	    });
	});
	it('should generate the correct fifth trade', function(){
	    var i;
	    var myBuyA = [];
	    for(i=0;i<100;++i)
		myBuyA[i] = i;
	    trades[4].should.deepEqual({
		t:0,
		bs: 's',
		prices: (new Array(100).fill(100)),
		totalQ: 100,
		buyQ: (new Array(100).fill(1)),
		sellQ: [100],
		buyId: (new Array(100).fill(1)),
		sellId: [3],
		buyA: myBuyA,
		sellA: [202]
	    });
	});
	it('should generate the correct sixth trade', function(){
	    var i;
	    var myBuyA = [];
	    for(i=0;i<53;++i)
		myBuyA[i]=i;
	    trades[5].should.deepEqual({
		t:0,
		bs: 's',
		prices: (new Array(53).fill(100)),
		totalQ: 53,
		buyQ: (new Array(53).fill(1)),
		sellQ: [53],
		buyId: (new Array(53).fill(1)),
		sellId: [3],
		buyA: myBuyA,
		sellA: [102]
	    });
	});
	it('should have 49 orders in buy book', function(){
	    assert.equal(AM.book.buy.idx.length, 49);
	});
	it('shiuld hvae 49 orders in .a', function(){
	    assert.equal(AM.a.length, 49);
	});
	it('should have empty sell book', function(){
	    assert.ok(AM.book.sell.idx.length === 0);
	});
	it('should have empty buyStop and sellStop books', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	    assert.ok(AM.book.sellStop.idx.length === 0);
	});
    });

    describe('300 buy 1@100, 1@110,1@120, sell stop 1@112, sell stop 250@112 limit 112, sell 1@115, sell 1@105', function(){
	var scenario=[];
	var i,l;
	for(i=0,l=300;i<l;++i)
	    scenario.push(orders.id1_buy_1_at_100.slice());
	scenario.push.apply(scenario, [
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112,
	    orders.id3_sellstop_250_at_112_limit_112,
	    orders.id2_sell_1_at_115,
	    orders.id2_sell_1_at_105
	]);
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.equal(AM.inbox.length, 0);
	});
	it('should execute a stop-loss', function(){
	    assert.ok(stops.length>0);
	});
	it('should generate a match against stop books of [0,2]', function(){
	    stops.should.deepEqual([[0,2]]);
	});
	it('should generate 3 trades', function(){
	    // each book.limit===100 matches will appear in a separate trade
	    assert.equal(trades.length, 3);
	});
	it('should generate the correct first trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [301],
		sellA: [304]		
	    });
	});
	it('should generate the correct second trade', function(){
	    trades[1].should.deepEqual({
		t:0,
		bs: 's',
		prices: [110],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [300],
		sellA: [303]
	    });
	});
	it('should generate the correct third trade', function(){
	    trades[2].should.deepEqual({
		t:0,
		bs: 's',
		prices: [100],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [3],
		buyA: [0],
		sellA: [300]		
	    });
	});
	it('should have 97 orders in buy book', function(){
	    assert.equal(AM.book.buy.idx.length, 97);
	});
	it('shiuld hvae 300 orders in .a', function(){
	    assert.equal(AM.a.length, 300);
	});
	it('should have one order in sell book', function(){
	    assert.ok(AM.book.sell.idx.length === 1);
	});
	it('should have first order in sell book be a limit sell order for 250 units at 112', function(){
	    var sell1 = AM.book.sell.idxdata(0);
	    var spCol = AM.o.spCol, ssCol = AM.o.ssCol, sspCol = AM.o.sspCol, qCol = AM.o.qCol;
	    assert.equal(sell1[spCol], 112);
	    assert.equal(sell1[ssCol], 0);
	    assert.equal(sell1[sspCol], 0);
	    assert.equal(sell1[qCol], 250);
	});
	it('should have empty buyStop and sellStop books', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	    assert.ok(AM.book.sellStop.idx.length === 0);
	});
    });

    describe('buy triggers another buy', function(){
	var scenario = [
	    orders.id2_sell_1_at_95,
	    orders.id2_sell_1_at_105,
	    orders.id2_sell_1_at_115,
	    orders.id4_buy_1_at_110_triggers_buy_1_at_120
	];
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.ok(AM.inbox.length === 0);
	});
	it('should not execute any stops', function(){
	    assert.ok(stops.length === 0);
	});
	it('should generate 2 trades', function(){
	    assert.equal(trades.length, 2);
	});
	it('should generate trade prices of 95 and 105', function(){
	    assert.equal(trades[0].prices[0], 95);
	    assert.equal(trades[1].prices[0], 105);
	});
	it('should have empty buy book', function(){
	    assert.ok(AM.book.buy.idx.length === 0);
	});
	it('should have sell book with one order at 115', function(){
	    assert.ok(AM.book.sell.idx.length === 1);
	    assert.ok(AM.book.sell.val(0) === 115);
	});
    });

    describe('buy triggers OCO bracket sell-to-close', function(){
	var scenario = [
	    orders.id2_sell_1_at_95,
	    orders.id2_sell_1_at_105,
	    orders.id2_sell_1_at_115,
	    orders.id4_buy_1_at_110_triggers_sell_1_at_120_stoplimit_100
	    ];
	var AM = new Market({});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.ok(AM.inbox.length === 0);
	});
	it('should not execute any stops', function(){
	    assert.ok(stops.length === 0);
	});
	it('should generate 1 trade', function(){
	    assert.equal(trades.length, 1);
	});
	it('should have empty buy book', function(){
	    assert.equal(AM.book.buy.idx.length, 0);
	});
	it('should have 3 orders in sell book', function(){
	    assert.equal(AM.book.sell.idx.length, 3);
	});
	it('should have 120 OCO stoplimit 100 as last sell book order', function(){
	    omit2(AM.book.sell.idxdata(2)).should.deepEqual(orders.id4_sell_1_at_120_OCO_100);
	});
    }); 
    
});

describe('Market(options={bookfixed:1, booklimit:1, buyImprove:{level:0}})', function(){
    describe('300 buy 1@100, 1@110,1@120, sell stop 1@112, sell stop 250@112 limit 112, sell 1@115, sell 1@105', function(){
	var scenario=[];
	var i,l;
	for(i=0,l=300;i<l;++i)
	    scenario.push(orders.id1_buy_1_at_100.slice());
	scenario.push.apply(scenario, [
	    orders.id1_buy_1_at_110,
	    orders.id1_buy_1_at_120,
	    orders.id3_sellstop_1_at_112,
	    orders.id3_sellstop_250_at_112_limit_112,
	    orders.id2_sell_1_at_115,
	    orders.id2_sell_1_at_105
	]);
	var AM = new Market({bookfixed:1, booklimit:1, buyImprove:{level:0}});
	var trades=[], stops = [];
	AM.on('trade', function(tradespec){ trades.push(tradespec) });
	AM.on('stops', function(t, matches){ stops.push(matches) });
	process(AM, scenario);
	it('should have empty inbox', function(){
	    assert.equal(AM.inbox.length, 0);
	});
	it('should execute a stop-loss', function(){
	    assert.ok(stops.length>0);
	});
	it('should generate two matches against stop books, each [0,1]', function(){
	    /* because sell stop book here has limit 1 */
	    stops.should.deepEqual([[0,1],[0,1]]);
	});
	it('should generate 3 trades', function(){
	    // since booklimit===1 each match appears as a separate trade
	    assert.equal(trades.length, 3);
	});
	it('should generate the correct first trade', function(){
	    trades[0].should.deepEqual({
		t: 0,
		bs: 's',
		prices: [120],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [2],
		sellA: [5]		
	    });
	});
	it('should generate the correct second trade', function(){
	    trades[1].should.deepEqual({
		t:0,
		bs: 's',
		prices: [110],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [2],
		buyA: [1],
		sellA: [4]
	    });
	});
	it('should generate the correct third trade', function(){
	    trades[2].should.deepEqual({
		t:0,
		bs: 's',
		prices: [100],
		totalQ: 1,
		buyQ: [1],
		sellQ: [1],
		buyId: [1],
		sellId: [3],
		buyA: [0],
		sellA: [1]		
	    });
	});
	it('should have zero orders in buy book (exhausted as 299 1@100 buy orders were rejected early)', function(){
	    assert.equal(AM.book.buy.idx.length, 0);
	});
	it('should have 1 order in .a', function(){
	    assert.equal(AM.a.length, 1);
	});
	it('should have one order in sell book', function(){
	    assert.ok(AM.book.sell.idx.length === 1);
	});
	it('should have first order in sell book be a limit sell order for 250 units at 112', function(){
	    var sell1 = AM.book.sell.idxdata(0);
	    var spCol = AM.o.spCol, ssCol = AM.o.ssCol, sspCol = AM.o.sspCol, qCol = AM.o.qCol;
	    assert.equal(sell1[spCol], 112);
	    assert.equal(sell1[ssCol], 0);
	    assert.equal(sell1[sspCol], 0);
	    assert.equal(sell1[qCol], 250);
	});
	it('should have empty buyStop and sellStop books', function(){
	    assert.ok(AM.book.buyStop.idx.length === 0);
	    assert.ok(AM.book.sellStop.idx.length === 0);
	});
    });

});

