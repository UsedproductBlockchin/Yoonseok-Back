'use strict'
var express = require("express");
const cors = require("cors");
var path = require("path");
var app = express();
const crypto = require("crypto");
var KeyValueDB = require("./kvdb");

// 물품 판매 상태 상수값
const ITEM_STATE_ONSALE = "ITEM_ONSALE";
const ITEM_STATE_PURCHASECOMPLETE = "ITEM_PURCHASECOMPLETE";
const ITEM_STATE_ONDELIVERY_REQ = "ITEM_ONDELIVERY_REQ";
const ITEM_STATE_ONDELIVERY = "ITEM_ONDELIVERY";
const ITEM_STATE_ONDELIVERYCOMPLETE_REQ = "ITEM_ONDELIVERYCOMPLETE_REQ";
const ITEM_STATE_DELIVERYCOMPLETE = "ITEM_DELIVERYCOMPLETE";
const ITEM_STATE_PURCHASECONFIRMED = "ITEM_PURCHASECONFIRMED";
const ITEM_STATE_PURCHASEDENIED = "ITEM_PURCHASEDENIED";
const ITEM_STATE_CYCLEFINISHED = "ITEM_CYCLEFINISHED";

// 구매결과 상수값
const PURCHASE_RESULT_CONFIRMED = "PURCHASE_CONFIRMED";
const PURCHASE_RESULT_DENIED = "PURCHASE_DENIED";

// 판매결과 상수값
const SALE_RESULT_COMPLETE = "SALE_COMPLETE";
const SALE_RESULT_DENIED = "SALE_DENIED";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"dist")));

var itemTable = new KeyValueDB;
var sellerTable = new KeyValueDB;
var buyerTable = new KeyValueDB;
var deliverymanTable = new KeyValueDB;
var itemStateTable = new KeyValueDB;
var purchaseHistoryTable = new KeyValueDB;
var saleHistoryTable = new KeyValueDB;

var debugConsole = true;

// 판매자,구매자,운송자 정보를 테이블에 추가
function initTable() {
	
	// 판매자 테이블
	sellerTable.createRecord({partyID:"seller1",partyPW:"1234",name:"손흥민",balance:100000},"itemID");
	
	sellerTable.createRecord({partyID:"seller2",partyPW:"1234",name:"박지성",balance:200000},"itemID");
	
	// 구매자 테이블
	buyerTable.createRecord({partyID:"buyer1",partyPW:"1234",name:"장동건",balance:300000},"itemID");
	buyerTable.createRecord({partyID:"buyer2",partyPW:"1234",name:"고소영",balance:400000},"itemID");

	// 운송자 테이블
	deliverymanTable.createRecord({partyID:"deliveryman1",partyPW:"1234",name:"김민재"},"itemID");
	deliverymanTable.createRecord({partyID:"deliveryman2",partyPW:"1234",name:"박완규"},"itemID");
	
	// 물품정보 테이블
	registerNewItem("seller1","Nikon Camera",960000,"hahahaha");
	registerNewItem("seller1","Sony Camera",320000,"hohohoho");
	registerNewItem("seller2","iPad Pro 4Th",1200000,"hohohoho");
	registerNewItem("seller2","Galaxy S10",650000,"hohohoho");
	
	// 구매이력 테이블
	
	// 판매이력 테이블
	
}

function existMatchedSeller(userid,userpw) {

	var sellerRecSet = sellerTable.getRecordSet("partyID",userid);
	if(sellerRecSet.length > 0) {
		if(sellerRecSet[0].partyPW === userpw) {
			return true;
		}
	}
	
	return false;
}

function existMatchedBuyer(userid,userpw) {

	var buyerRecSet = buyerTable.getRecordSet("partyID",userid);
	if(buyerRecSet.length > 0) {
		if(buyerRecSet[0].partyPW === userpw) {
			return true;
		}
	}
	
	return false;
}

function existMatchedDeliveryman(userid,userpw) {

	var deliverymanRecSet = deliverymanTable.getRecordSet("partyID",userid);
	if(deliverymanRecSet.length > 0) {
		if(deliverymanRecSet[0].partyPW === userpw) {
			return true;
		}
	}
	
	return false;
}

function registerNewItem(sellerID,itemName,itemPrice,itemDesc) {
	
	var itemInfo = {sellerID:sellerID,name:itemName,price:itemPrice,desc:itemDesc,timestamp:Date.now()};
	itemTable.createRecord(itemInfo,"itemID");
}

function modifyItem(itemID,itemName,itemPrice,itemDesc) {
	
	var itemList = itemTable.getRecordSet("itemID",itemID);
	if(itemList.length > 0) {
		itemList[0].name = itemName;
		itemList[0].price = itemPrice;
		itemList[0].desc = itemDesc;
		itemList[0].timestamp = Date.now();
	}

	itemTable.updateRecord(itemList[0]);
}

// 상품 판매상태 정보는 구매자가 상품을 구매했을 때 새로 추가됨!!
function registerNewItemState(sellerID,itemID,buyerID,buyerAddress) {
	
	var itemStateInfo = {sellerID:sellerID,itemID:itemID,state:ITEM_STATE_PURCHASECOMPLETE,buyerID:buyerID,purchaseDate:Date.now(),address:buyerAddress,deliverymanID:null};
	
	itemStateTable.createRecord(itemStateInfo,null);
	
	if(debugConsole === true) {
		var itemStateList = itemStateTable.getRecordSet("itemID",null);
		console.log("registerNewItemState():: itemStateList = "+JSON.stringify(itemStateList));
	}
}

// [판매자용]::내가 등록한 상품 목록 조회
function querySellerItemList(sellerID) {
	
	var itemList = itemTable.getRecordSet("sellerID",sellerID);
	var itemList2 = [];
	for(var i=0;i<itemList.length;i++) {
		var itemStateList = itemStateTable.getRecordSet("itemID",itemList[i].itemID);
		if(itemStateList.length > 0) {
			itemList[i]['state'] = itemStateList[0].state;
			itemList[i]['address'] = itemStateList[0].address;
			itemList[i]['buyerID'] = itemStateList[0].buyerID;
			itemList[i]['buyerName'] = buyerTable.getRecordSet("partyID",itemStateList[0].buyerID)[0].name;
			itemList[i]['deliverymanID'] = itemStateList[0].deliverymanID;
			
			if(itemStateList[0].state === ITEM_STATE_PURCHASEDENIED) {
				itemList[i]['denialReason'] = itemStateList[0].denialReason;
			}
			if(itemStateList[0].state !== ITEM_STATE_CYCLEFINISHED) {
				itemList2.push(itemList[i]);
			}
		} else {
			itemList[i]['state'] = ITEM_STATE_ONSALE;
			itemList2.push(itemList[i]);
		}
	}
	
	return itemList2;
}

// [구매자용]::내가 현재 구매한 상품 목록 조회
function queryPurchasedItemList(buyerID) {

	var itemList2 = [];
	var itemStateList = itemStateTable.getRecordSet("buyerID",buyerID);
	
	if(debugConsole === true) {
		var itemStateList = itemStateTable.getRecordSet("itemID",null);
		console.log("queryPurchasedItemList():: itemStateList = "+JSON.stringify(itemStateList));
		
		var itemList = itemTable.getRecordSet("itemID",null);
		console.log("queryPurchasedItemList():: itemList = "+JSON.stringify(itemList));
	}
	
	for(var i=0;i<itemStateList.length;i++) {
		var itemList = itemTable.getRecordSet("itemID",itemStateList[i].itemID);
		if(itemStateList[i].state !== undefined && itemStateList[i].state !== ITEM_STATE_CYCLEFINISHED && itemStateList[i].state !== ITEM_STATE_PURCHASECONFIRMED && itemStateList[i].state !== ITEM_STATE_PURCHASEDENIED) {
			itemList[0]['state'] = itemStateList[i].state;
			itemList[0]['buyerID'] = itemStateList[i].buyerID;
			itemList[0]['sellerName'] = sellerTable.getRecordSet("partyID",itemStateList[i].sellerID)[0].name;
			itemList2.push(itemList[0]);	
		}
	}
	
	return itemList2;
}

// [구매자용]::구매가능한 모든 상품 목록 조회
function queryOnSaleItemList() {
	
	var itemList = itemTable.getRecordSet("sellerID",null);
	
	var itemList2 = [];
	for(var i=0;i<itemList.length;i++) {
		var itemStateList = itemStateTable.getRecordSet("itemID",itemList[i].itemID);
		if(itemStateList.length === 0) {
			var sellerInfo = sellerTable.getRecordSet("partyID",itemList[i].sellerID)[0];
			itemList[i]['sellerName'] = sellerInfo.name;
			itemList2.push(itemList[i]);
		}
	}
	return itemList2;
}

// [운송자용]::운송해야하는/운송중인 상품 목록 조회
function queryDeliveryItemList(deliverymanID) {
	
	var itemList = itemTable.getRecordSet("sellerID",null);
	
	var itemList2 = [];
	for(var i=0;i<itemList.length;i++) {
		var itemStateList = itemStateTable.getRecordSet("itemID",itemList[i].itemID);
		
		if(debugConsole !== null) {
			console.log(" ");
			console.log("### itemStateList[0]="+JSON.stringify(itemStateList[0])+", deliverymanID="+deliverymanID);
		}
		
		if(itemStateList.length > 0 && itemStateList[0].deliverymanID !== null && itemStateList[0].deliverymanID === deliverymanID && 
			(itemStateList[0].state === ITEM_STATE_ONDELIVERY_REQ || itemStateList[0].state === ITEM_STATE_ONDELIVERY || itemStateList[0].state === ITEM_STATE_ONDELIVERYCOMPLETE_REQ)) {
			itemList[i]['state'] = itemStateList[0].state;
			itemList[i]['address'] = itemStateList[0].address;
			itemList[i]['buyerID'] = itemStateList[0].buyerID;
			itemList[i]['buyerName'] = buyerTable.getRecordSet("partyID",itemStateList[0].buyerID)[0].name;
			itemList2.push(itemList[i]);
		}
	}
	return itemList2;
}

// 신규 구매이력 정보 생성
function registerNewPurchaseHistory(buyerID,sellerID,itemID,lastDate,txPurchaseResult) {
	
	var historyInfo = {buyerID:buyerID,sellerID:sellerID,itemID:itemID,lastDate:lastDate,result:txPurchaseResult};
	
	purchaseHistoryTable.createRecord(historyInfo,"historyID");
	
	if(debugConsole === true) {
		var historyList = purchaseHistoryTable.getRecordSet("historyID",null);
		console.log("registerNewPurchaseHistory():: historyList = "+JSON.stringify(historyList));
	}
}

// 구매이력 정보 조회
function queryPurchaseHistory(buyerID) {
	
	console.log("----------");
	console.log("historyTable="+JSON.stringify(purchaseHistoryTable.getRecordSet("buyerID",null))+", buyerID="+buyerID);
	
	var historyList = purchaseHistoryTable.getRecordSet("buyerID",buyerID);
	
	console.log("historyList="+JSON.stringify(historyList));
	
	var historyList2 = [];
	for(var i=0;i<historyList.length;i++) {
		var itemInfo = itemTable.getRecordSet("itemID",historyList[i].itemID)[0];
		var sellerInfo = sellerTable.getRecordSet("partyID",historyList[i].sellerID)[0];
		
		historyList[i]['itemName'] = itemInfo.name;
		historyList[i]['sellerName'] = sellerInfo.name;
		historyList2.push(historyList[i]);
	}
	return historyList2;
}

// 신규 판매이력 정보 생성
function registerNewSaleHistory(sellerID,buyerID,itemID,lastDate,txSaleResult) {
	
	var historyInfo = {sellerID:sellerID,buyerID:buyerID,itemID:itemID,lastDate:lastDate,result:txSaleResult};
	
	saleHistoryTable.createRecord(historyInfo,"historyID");
	
	if(debugConsole === true) {
		var historyList = saleHistoryTable.getRecordSet("historyID",null);
		console.log("registerNewSaleHistory():: historyList = "+JSON.stringify(historyList));
	}
}

// 판매이력 정보 조회
function querySaleHistory(sellerID) {
	
	var historyList = saleHistoryTable.getRecordSet("sellerID",sellerID);
	
	var historyList2 = [];
	for(var i=0;i<historyList.length;i++) {
		var itemInfo = itemTable.getRecordSet("itemID",historyList[i].itemID)[0];
		var buyerInfo = buyerTable.getRecordSet("partyID",historyList[i].buyerID)[0];
		
		historyList[i]['itemName'] = itemInfo.name;
		historyList[i]['buyerName'] = buyerInfo.name;
		historyList2.push(historyList[i]);
	}
	return historyList2;
}

app.listen(3000, function() {
    console.log("listening...");
	
	initTable();
});

// 로그인 처리
app.post("/login", function(req,res) {

	var token = crypto.createHash('md5').update(req.body.userid+req.body.password).digest('hex');
	var authSuccess = false;
	var partyInfo = null;
	var itemList = [];
	if(req.body.partyType === "seller" && existMatchedSeller(req.body.userid,req.body.password) === true) {
		authSuccess = true;
		partyInfo = sellerTable.getRecordSet("partyID",req.body.userid)[0];		
		itemList = querySellerItemList(req.body.userid);
		
	} else if(req.body.partyType === "buyer" && existMatchedBuyer(req.body.userid,req.body.password) === true) {
		authSuccess = true;
		partyInfo = buyerTable.getRecordSet("partyID",req.body.userid)[0];
		itemList = itemTable.getRecordSet("sellerID",null);
		
		var itemList2 = [];
		for(var i=0;i<itemList.length;i++) {
			var itemStateList = itemStateTable.getRecordSet("itemID",itemList[i].itemID);
			if(itemStateList.length === 0) {
				itemList[i]['sellerName'] = sellerTable.getRecordSet("partyID",itemList[i].sellerID)[0].name;
				itemList2.push(itemList[i]);
			}
		}
		
		itemList = itemList2;
		
	} else if(req.body.partyType === "deliveryman" && existMatchedDeliveryman(req.body.userid,req.body.password) === true) {
		authSuccess = true;
		partyInfo = deliverymanTable.getRecordSet("partyID",req.body.userid)[0];
		
		itemList = queryDeliveryItemList(req.body.userid);
	}
	
    console.log("userID="+req.body.userid+", password="+req.body.password+", party="+req.body.partyType);
	
	if(authSuccess === true) {
		res.status(200).send({result:0,data:{partyType:req.body.partyType,partyInfo:partyInfo,itemList:itemList,token:token}});
	} else {
	    res.status(200).send({result:-1,data:null});	
	}
});

// 로그아웃 처리
app.post("/logout", function(req,res) {
    console.log("logout::userID="+req.body.userid);
    res.status(200).send({result:0,data:{}});
});

// 판매상품 목록 조회 처리
app.post("/seller_getitemlist", function(req,res) {
		
	var itemList = itemTable.getRecordSet("sellerID",req.body.sellerID);
	var itemList2 = [];
	for(var i=0;i<itemList.length;i++) {
		var itemStateList = itemStateTable.getRecordSet("itemID",itemList[i].itemID);
		if(itemStateList.length === 0 || itemStateList[0].state === undefined) {
			itemList[i]['state'] = ITEM_STATE_ONSALE;	
		} else {
			itemList[i]['state'] = itemStateList[0].state;
			itemList[i]['address'] = itemStateList[0].address;
			itemList[i]['buyerID'] = itemStateList[0].buyerID;
			itemList[i]['buyerName'] = buyerTable.getRecordSet("partyID",itemStateList[0].buyerID)[0].name;
		}
		itemList2.push(itemList[i]);
	}
	console.log("itemList="+JSON.stringify(itemList2));
	
	res.status(200).send({result:0,data:{itemList:itemList2}});
});

// 신규 상품 등록 처리
app.post("/seller_registeritem", function(req,res) {
	
	registerNewItem(req.body.sellerID,req.body.itemName,req.body.itemPrice,req.body.itemDesc);
	
	var itemList = itemTable.getRecordSet("sellerID",req.body.sellerID);
	for(var i=0;i<itemList.length;i++) {
		if(itemList[i].state === undefined) {
				itemList[i]['state'] = ITEM_STATE_ONSALE;	
		}
	}
	console.log("itemList="+JSON.stringify(itemList));
	
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 상품정보 수정 처리
app.post("/seller_modifyitem", function(req,res) {
	
	modifyItem(req.body.itemID,req.body.itemName,req.body.itemPrice,req.body.itemDesc);
	
	var itemList = itemTable.getRecordSet("sellerID",req.body.sellerID);
	console.log("itemList="+JSON.stringify(itemList));
	
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 운송자 목록 처리
app.post("/seller_getdeliverymanlist", function(req,res) {
	
	var deliverymanList = deliverymanTable.getRecordSet("partyID",null);
	if(debugConsole === true) {
		console.log("deliverymanList="+JSON.stringify(deliverymanList));
	}
	res.status(200).send({result:0,data:{deliverymanList:deliverymanList}});
});

// 운송자에게 배달요청 처리
app.post("/seller_requestdelivery", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	itemStateList[0].deliverymanID = req.body.deliverymanID;
	itemStateList[0].state = ITEM_STATE_ONDELIVERY_REQ;
	itemStateTable.updateRecord(itemStateList[0]);
	
	var itemList = querySellerItemList(itemStateList[0].sellerID);
	
	if(debugConsole === true) {
		console.log("itemStateList[0]="+JSON.stringify(itemStateList[0]));
	}
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 대금 지불요청 처리
app.post("/seller_requestitemfee", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(itemStateList[0].sellerID === req.body.sellerID) {
		//itemStateList[0].deliverymanID = req.body.deliverymanID;
		itemStateList[0].state = ITEM_STATE_CYCLEFINISHED;
		itemStateTable.updateRecord(itemStateList[0]);
	
		var itemList = querySellerItemList(itemStateList[0].sellerID);
	
		var itemInfo = itemTable.getRecordSet("itemID",req.body.itemID)[0];
		
		var partyInfo = sellerTable.getRecordSet("partyID",itemStateList[0].sellerID)[0];
		
		if(debugConsole === true) {
			console.log(" ");
			console.log("itemStateList[0]="+JSON.stringify(itemStateList[0]));
			console.log("partyInfo.balance="+partyInfo.balance+", price="+itemInfo.price);
		}
		
		partyInfo.balance = partyInfo.balance + itemInfo.price;
		sellerTable.updateRecord(partyInfo);
		
		res.status(200).send({result:0,data:{partyInfo:partyInfo,itemList:itemList}});	
	} else {
		res.status(200).send({result:2,data:{}});			
	}
});

// 판매자의 판매이력 조회
app.post("/seller_salehistory", function(req,res) {
	
	var historyList = querySaleHistory(req.body.sellerID);
	
	if(debugConsole === true) {
		console.log(" ");
		console.log("historyList="+JSON.stringify(historyList));
	}
	
	res.status(200).send({result:0,data:{historyList:historyList}});
});

// 구매한/판매중인 상품목록 조회
app.post("/buyer_getitemlist", function(req,res) {
	
	var itemList;
	if(req.body.listType === "PURCHASED") {
		itemList = queryPurchasedItemList(req.body.buyerID);
	} else {
		itemList = queryOnSaleItemList();
	}
		
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 상품 구매하기 처리
app.post("/buyer_requestpurchase", function(req,res) {
	
	var itemList = itemTable.getRecordSet("itemID",req.body.itemID);
	registerNewItemState(itemList[0].sellerID,req.body.itemID,req.body.buyerID,req.body.deliveryAddress);
	
	itemList = queryPurchasedItemList(req.body.buyerID);
	
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 상품 수령하기 처리
app.post("/buyer_confirmitemget", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(req.body.buyerID === itemStateList[0].buyerID) {
		var itemList = itemTable.getRecordSet("itemID",req.body.itemID);
		itemStateList[0].state = ITEM_STATE_DELIVERYCOMPLETE;
		itemStateTable.updateRecord(itemStateList[0]);
	
		itemList = queryPurchasedItemList(req.body.buyerID);
	
		res.status(200).send({result:0,data:{itemList:itemList}});
	} else {
		res.status(200).send({result:2,data:{}});
	}
});

// 상품 구매확정하기 처리
app.post("/buyer_confirmpurchase", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(req.body.buyerID === itemStateList[0].buyerID) {
		var itemList = itemTable.getRecordSet("itemID",req.body.itemID);
		itemStateList[0].state = ITEM_STATE_PURCHASECONFIRMED;
		itemStateTable.updateRecord(itemStateList[0]);
	
		itemList = queryPurchasedItemList(req.body.buyerID);
	
		var curDate = new Date();
		var lastDate = curDate.toISOString();
		registerNewPurchaseHistory(req.body.buyerID,itemStateList[0].sellerID,req.body.itemID,lastDate,PURCHASE_RESULT_CONFIRMED);
		registerNewSaleHistory(itemStateList[0].sellerID,req.body.buyerID,req.body.itemID,lastDate,SALE_RESULT_COMPLETE);
		
		res.status(200).send({result:0,data:{itemList:itemList}});	
	} else {
		res.status(200).send({result:2,data:{}});
	}
});

// 상품 구매거부하기 처리
app.post("/buyer_denypurchase", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(req.body.buyerID === itemStateList[0].buyerID) {
		var itemList = itemTable.getRecordSet("itemID",req.body.itemID);
		itemStateList[0].state = ITEM_STATE_PURCHASEDENIED;
		itemStateList[0]['denialReason'] = req.body.denialReason;
		itemStateTable.updateRecord(itemStateList[0]);
	
		itemList = queryPurchasedItemList(req.body.buyerID);
		
		var curDate = new Date();
		var lastDate = curDate.toISOString();
		registerNewPurchaseHistory(req.body.buyerID,itemStateList[0].sellerID,req.body.itemID,lastDate,PURCHASE_RESULT_DENIED);
		registerNewSaleHistory(itemStateList[0].sellerID,req.body.buyerID,req.body.itemID,lastDate,SALE_RESULT_DENIED);
		
		res.status(200).send({result:0,data:{itemList:itemList}});
	} else {
		res.status(200).send({result:2,data:{}});
	}
});

// 구매자의 구매이력 조회
app.post("/buyer_purchasehistory", function(req,res) {
	
	var historyList = queryPurchaseHistory(req.body.buyerID);
	
	if(debugConsole === true) {
		console.log(" ");
		console.log("historyList="+JSON.stringify(historyList));
	}
	
	res.status(200).send({result:0,data:{historyList:historyList}});
});

// 배송목록 조회 처리
app.post("/deliveryman_getitemlist", function(req,res) {
	
	var itemList = queryDeliveryItemList(req.body.sellerID);
	res.status(200).send({result:0,data:{itemList:itemList}});
});

// 배송요청 접수 처리
app.post("/deliveryman_acceptdeliveryreq", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(itemStateList[0].deliverymanID === req.body.deliverymanID) {
		itemStateList[0].state = ITEM_STATE_ONDELIVERY;
		itemStateTable.updateRecord(itemStateList[0]);
	
		var itemList = queryPurchasedItemList(req.body.buyerID);
	
		if(debugConsole === true) {
			console.log(" ");
			console.log("itemStateList[0]="+JSON.stringify(itemStateList[0]));
		}
		res.status(200).send({result:0,data:{itemList:itemList}});
	} else {
		res.status(200).send({result:2,data:{}});
	}

});

// 배송완료 요청 처리
app.post("/deliveryman_completeDelivery", function(req,res) {
	
	var itemStateList = itemStateTable.getRecordSet("itemID",req.body.itemID);
	if(itemStateList[0].deliverymanID === req.body.deliverymanID) {
		itemStateList[0].state = ITEM_STATE_ONDELIVERYCOMPLETE_REQ;
		itemStateTable.updateRecord(itemStateList[0]);
	
		var itemList = queryPurchasedItemList(req.body.buyerID);
	
		if(debugConsole === true) {
			console.log(" ");
			console.log("itemStateList[0]="+JSON.stringify(itemStateList[0]));
		}
		res.status(200).send({result:0,data:{itemList:itemList}});
	} else {
		res.status(200).send({result:2,data:{}});
	}
});

app.get("/test", function(req,res) {
    res.status(200).send("hahaha"+req.query.id);
});
