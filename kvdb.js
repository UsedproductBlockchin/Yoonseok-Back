'use strict'
const crypto = require("crypto");

// JSON포맷을 기반으로 간단한 nosql 메모리 저장소 구현.
// key=value와 일치하는 레코드셋을 조회할 수 있음.
class KeyValueDB {
	constructor() {
		this._keyStore = {};
	}
	
	createRecord(rec,keyID) {
		
		var recID = crypto.randomBytes(20).toString('hex');
		this._keyStore[recID] = rec;
		this._keyStore[recID].recID = recID;
		if(keyID !== null) {
				this._keyStore[recID][keyID] = recID;	
		}

		return recID;
	}
	
	updateRecord(rec) {
		
		var keys = Object.keys(this._keyStore);
		for (var i=0;i<keys.length;i++) {
			var recInDB = this._keyStore[keys[i]];
			if(recInDB.recID === rec.recID) {
				this._keyStore[keys[i]] = rec;
				return true;
			}
		}
		
		return false;
	}
	
	getRecordSet(key,value) {

		var resultSet = [];
		var keys = Object.keys(this._keyStore);
		
		for (var i=0;i<keys.length;i++) {
			var recInDB = this._keyStore[keys[i]];
			var keysInRec = Object.keys(recInDB);
			for (var j=0;j<keysInRec.length;j++) {
				if(keysInRec[j] === key && (recInDB[key] === value || value === null)) {
					resultSet.push(recInDB);
				}
			}
		}
		
		return resultSet;
	}
	
	getRawSet() {
		
		var resultSet = [];
		var keys = Object.keys(this._keyStore);
		
		for (var i=0;i<keys.length;i++) {
			resultSet.push(this._keyStore[keys[i]]);
		}
		
		return resultSet;
	}
}

module.exports = KeyValueDB;