/*jslint node: true */
"use strict";
var conf = require('trustnote-common/conf.js');
var db = require('trustnote-common/db.js');
var storage = require('trustnote-common/storage.js');
var eventBus = require('trustnote-common/event_bus.js');
var mail = require('trustnote-common/mail.js');
var headlessWallet = require('trustnote-headless');
var desktopApp = require('trustnote-common/desktop_app.js');
var objectHash = require('trustnote-common/object_hash.js');
var constants = require('trustnote-common/constants.js');
var async = require('async');

var composer = require('trustnote-common/composer.js');
var network = require('trustnote-common/network.js');
var equihash = require('./equihash.js');
var trustme = require('./trustme.js');


var WITNESSING_COST = 600; // size of typical witnessing unit
var my_address;
var bWitnessingUnderWay = false;
var forcedWitnessingTimer;
var count_witnessings_available = 0;

if (!conf.bSingleAddress)
	throw Error('witness must be single address');

headlessWallet.setupChatEventHandlers();



function notifyAdmin(subject, body){
	mail.sendmail({
		to: conf.admin_email,
		from: conf.from_email,
		subject: subject,
		body: body
	});
}

function notifyAdminAboutFailedWitnessing(err){
	console.log('witnessing failed: '+err);
	notifyAdmin('witnessing failed: '+err, err);
}

function notifyAdminAboutWitnessingProblem(err){
	console.log('witnessing problem: '+err);
	notifyAdmin('witnessing problem: '+err, err);
}


function witness(onDone){
	function onError(err){
		notifyAdminAboutFailedWitnessing(err);
		setTimeout(onDone, 60000); // pause after error
	}
	var network = require('trustnote-common/network.js');
	var composer = require('trustnote-common/composer.js');
	if (!network.isConnected()){
		console.log('not connected, skipping');
		return onDone();
	}
	createOptimalOutputs(function(arrOutputs){
		let params = {
			paying_addresses: [my_address],
			outputs: arrOutputs,
			signer: headlessWallet.signer,
			callbacks: composer.getSavingCallbacks({
				ifNotEnoughFunds: onError,
				ifError: onError,
				ifOk: function(objJoint){
					network.broadcastJoint(objJoint);
					onDone();
				}
			})
		};
		if (conf.bPostTimestamp){
			let timestamp = Date.now();
			let datafeed = {timestamp: timestamp};
			let objMessage = {
				app: "data_feed",
				payload_location: "inline",
				payload_hash: objectHash.getBase64Hash(datafeed),
				payload: datafeed
			};
			params.messages = [objMessage];
		}
		composer.composeJoint(params);
	});
}

function checkAndWitness(){
	console.log('checkAndWitness');
	clearTimeout(forcedWitnessingTimer);
	if (bWitnessingUnderWay)
		return console.log('witnessing under way');
	bWitnessingUnderWay = true;
	// abort if there are my units without an mci
	determineIfThereAreMyUnitsWithoutMci(function(bMyUnitsWithoutMci){
		if (bMyUnitsWithoutMci){
			bWitnessingUnderWay = false;
			return console.log('my units without mci');
		}
		storage.readLastMainChainIndex(function(max_mci){
			let col = (conf.storage === 'mysql') ? 'main_chain_index' : 'unit_authors.rowid';
			db.query(
				"SELECT main_chain_index AS max_my_mci FROM units JOIN unit_authors USING(unit) WHERE address=? ORDER BY "+col+" DESC LIMIT 1",
				[my_address],
				function(rows){
					var max_my_mci = (rows.length > 0) ? rows[0].max_my_mci : -1000;
					var distance = max_mci - max_my_mci;
					console.log("distance="+distance);
					if (distance > conf.THRESHOLD_DISTANCE){
						console.log('distance above threshold, will witness');
						//modi winess payment victor
						//setTimeout(function(){
						//	witness(function(){
						//		bWitnessingUnderWay = false;
						//	});
						//}, Math.round(Math.random()*3000));
						bWitnessingUnderWay = false;
						checkForUnconfirmedUnitsAndWitness(conf.THRESHOLD_DISTANCE/distance);
					}
					else{
						bWitnessingUnderWay = false;
						checkForUnconfirmedUnits(conf.THRESHOLD_DISTANCE - distance);
					}
				}
			);
		});
	});
}

function determineIfThereAreMyUnitsWithoutMci(handleResult){
	db.query("SELECT 1 FROM units JOIN unit_authors USING(unit) WHERE address=? AND main_chain_index IS NULL LIMIT 1", [my_address], function(rows){
		handleResult(rows.length > 0);
	});
}

function checkForUnconfirmedUnits(distance_to_threshold){
	db.query( // look for unstable non-witness-authored units
		"SELECT 1 FROM units CROSS JOIN unit_authors USING(unit) LEFT JOIN my_witnesses USING(address) \n\
		WHERE (main_chain_index>? OR main_chain_index IS NULL AND sequence='good') \n\
			AND my_witnesses.address IS NULL \n\
			AND NOT ( \n\
				(SELECT COUNT(*) FROM messages WHERE messages.unit=units.unit)=1 \n\
				AND (SELECT COUNT(*) FROM unit_authors WHERE unit_authors.unit=units.unit)=1 \n\
				AND (SELECT COUNT(DISTINCT address) FROM outputs WHERE outputs.unit=units.unit)=1 \n\
				AND (SELECT address FROM outputs WHERE outputs.unit=units.unit LIMIT 1)=unit_authors.address \n\
			) \n\
		LIMIT 1",
		[storage.getMinRetrievableMci()], // light clients see all retrievable as unconfirmed
		function(rows){
			if (rows.length === 0)
				return;
			var timeout = Math.round((distance_to_threshold + Math.random())*10000);
			console.log('scheduling unconditional witnessing in '+timeout+' ms unless a new unit arrives');
			forcedWitnessingTimer = setTimeout(witnessBeforeThreshold, timeout);
		}
	);
}

//add winess payment victor
function checkForUnconfirmedUnitsAndWitness(distance_to_threshold){
	db.query( // look for unstable non-witness-authored units
		"SELECT 1 FROM units CROSS JOIN unit_authors USING(unit) LEFT JOIN my_witnesses USING(address) \n\
		WHERE (main_chain_index>? OR main_chain_index IS NULL AND sequence='good') \n\
			AND my_witnesses.address IS NULL \n\
			AND NOT ( \n\
				(SELECT COUNT(*) FROM messages WHERE messages.unit=units.unit)=1 \n\
				AND (SELECT COUNT(*) FROM unit_authors WHERE unit_authors.unit=units.unit)=1 \n\
				AND (SELECT COUNT(DISTINCT address) FROM outputs WHERE outputs.unit=units.unit)=1 \n\
				AND (SELECT address FROM outputs WHERE outputs.unit=units.unit LIMIT 1)=unit_authors.address \n\
			) \n\
		LIMIT 1",
		[storage.getMinRetrievableMci()], // light clients see all retrievable as unconfirmed
		function(rows){
			if (rows.length === 0)
				return;
			var timeout = Math.round((distance_to_threshold + Math.random())*1000);
			console.log('scheduling unconditional witnessing in '+timeout+' ms unless a new unit arrives');
			forcedWitnessingTimer = setTimeout(witnessBeforeThreshold, timeout);
		}
	);
}

function witnessBeforeThreshold(){
	if (bWitnessingUnderWay)
		return;
	bWitnessingUnderWay = true;
	determineIfThereAreMyUnitsWithoutMci(function(bMyUnitsWithoutMci){
		if (bMyUnitsWithoutMci){
			bWitnessingUnderWay = false;
			return;
		}
		console.log('will witness before threshold');
		witness(function(){
			bWitnessingUnderWay = false;
		});
	});
}

function readNumberOfWitnessingsAvailable(handleNumber){
	count_witnessings_available--;
	if (count_witnessings_available > conf.MIN_AVAILABLE_WITNESSINGS)
		return handleNumber(count_witnessings_available);
	db.query(
		"SELECT COUNT(*) AS count_big_outputs FROM outputs JOIN units USING(unit) \n\
		WHERE address=? AND is_stable=1 AND amount>=? AND asset IS NULL AND is_spent=0",
		[my_address, WITNESSING_COST],
		function(rows){
			var count_big_outputs = rows[0].count_big_outputs;
			db.query(
				"SELECT SUM(amount) AS total FROM outputs JOIN units USING(unit) \n\
				WHERE address=? AND is_stable=1 AND amount<? AND asset IS NULL AND is_spent=0 \n\
				UNION \n\
				SELECT SUM(amount) AS total FROM witnessing_outputs \n\
				WHERE address=? AND is_spent=0 \n\
				UNION \n\
				SELECT SUM(amount) AS total FROM headers_commission_outputs \n\
				WHERE address=? AND is_spent=0",
				[my_address, WITNESSING_COST, my_address, my_address],
				function(rows){
					var total = rows.reduce(function(prev, row){ return (prev + row.total); }, 0);
					var count_witnessings_paid_by_small_outputs_and_commissions = Math.round(total / WITNESSING_COST);
					count_witnessings_available = count_big_outputs + count_witnessings_paid_by_small_outputs_and_commissions;
					handleNumber(count_witnessings_available);
				}
			);
		}
	);
}

// make sure we never run out of spendable (stable) outputs. Keep the number above a threshold, and if it drops below, produce more outputs than consume.
function createOptimalOutputs(handleOutputs){
	var arrOutputs = [{amount: 0, address: my_address}];
	readNumberOfWitnessingsAvailable(function(count){
		if (count > conf.MIN_AVAILABLE_WITNESSINGS)
			return handleOutputs(arrOutputs);
		// try to split the biggest output in two
		db.query(
			"SELECT amount FROM outputs JOIN units USING(unit) \n\
			WHERE address=? AND is_stable=1 AND amount>=? AND asset IS NULL AND is_spent=0 \n\
			ORDER BY amount DESC LIMIT 1",
			[my_address, 2*WITNESSING_COST],
			function(rows){
				if (rows.length === 0){
					notifyAdminAboutWitnessingProblem('only '+count+" spendable outputs left, and can't add more");
					return handleOutputs(arrOutputs);
				}
				var amount = rows[0].amount;
				notifyAdminAboutWitnessingProblem('only '+count+" spendable outputs left, will split an output of "+amount);
				arrOutputs.push({amount: Math.round(amount/2), address: my_address});
				handleOutputs(arrOutputs);
			}
		);
	});
}

db.query("CREATE UNIQUE INDEX IF NOT EXISTS hcobyAddressSpentMci ON headers_commission_outputs(address, is_spent, main_chain_index)");
db.query("CREATE UNIQUE INDEX IF NOT EXISTS byWitnessAddressSpentMci ON witnessing_outputs(address, is_spent, main_chain_index)");

eventBus.on('headless_wallet_ready', function(){
	// if (!conf.admin_email || !conf.from_email){
	// 	console.log("please specify admin_email and from_email in your "+desktopApp.getAppDataDir()+'/conf.json');
	// 	process.exit(1);
	// }
	console.log("headless_wallet_ready triggered");
	headlessWallet.readSingleAddress(function(address){
		my_address = address;
		restoreRound();
		//checkAndWitness();
		// eventBus.on('new_joint', checkAndWitness); // new_joint event is not sent while we are catching up
		eventBus.on('mci_became_stable', updateSuperGrp);
	});
});

function insertAttestor( mci) {
	for (var i = 0; i < global.curSuperGrp.length; i++) {
		db.query("insert into attestor values(?,?,?)", [global.curRnd, global.curSuperGrp[i], mci]);
	}
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateSuperGrp(mci) {
	console.info("mainchain advance to", mci);

	db.query("select rnd_num,address from units join equihash using(unit) where main_chain_index=? order by units.level,units.unit limit ?", [mci, constants.COUNT_WITNESSES], function (rows) {
		if (rows.length === 0)
			return;
		async.eachSeries(rows,
			function (row, cb) {
				if (row.rnd_num > global.nxtRnd) {
					insertAttestor( mci);
					global.curRnd = row.rnd_num - 1;
					global.nxtRnd = row.rnd_num;
					global.nxtSuperGrp = [];
					global.curSuperGrp = [];
					global.nxtSuperGrp.push(row.address);
				} else if (row.rnd_num === global.nxtRnd) {
					if (global.nxtSuperGrp.indexOf(row.address) < 0) {
						global.nxtSuperGrp.push(row.address);
						if (global.nxtSuperGrp.length === constants.COUNT_WITNESSES) {
								if (conf.bServeAsSuperNode) {
									if (global.trustme_interval) {
										clearInterval(global.trustme_interval);
										console.info("stop trustme of round", global.curRnd);
									}
									setTimeout(equihash.startEquihash,getRandomInt(100,3000),my_address, global.nxtRnd + 1,headlessWallet.signer);
									// equihash.startEquihash(my_address, global.nxtRnd + 1,headlessWallet.signer);
									if (global.nxtSuperGrp.indexOf(my_address) > -1) {
										global.trustme_interval = setInterval(trustme.postTrustme, getRandomInt(5000,10000), global.nxtRnd,my_address,headlessWallet.signer);
									}
								}
								console.info("round change from %d to %d", global.curRnd, global.nxtRnd);
								insertAttestor(mci);
								global.curSuperGrp = global.nxtSuperGrp;
								global.nxtSuperGrp = [];
								global.curRnd = global.nxtRnd++;
						}
					}
				}
				cb();
			},
			function (err) {
				if (err)
					console.log(err);
			}
		);
	});
}


function restoreRound(){
	console.log("restoreRound triggerd");
	db.query("select max(rnd_num) as rnd_num,mci from attestor",function(rows){
		console.log("existed attestor",rows[0]);
		if(rows[0].rnd_num){
			global.curRnd=rows[0].rnd_num+1;
			global.nxtRnd=rows[0].rnd_num+2;
			db.query("select equihash.address from units join equihash using(unit) where is_stable=1 and main_chain_index>? order by main_chain_index asc,level desc,unit asc",rows[0].mci,function(rowss){
				if(rowss.length==0)
					return;
				for(var i=0;i<rowss.length;i++)
					global.curSuperGrp.push(rowss[i].address);

			});
		}
		if (conf.bServeAsSuperNode&&global.curRnd==0) {
			eventBus.on('new_joint',initial);
		}
	});
}


function initial(objJoint){
	if(storage.isGenesisUnit(objJoint.unit.unit)){
		eventBus.removeListener('new_joint',initial);
		equihash.startEquihash(my_address,1,headlessWallet.signer);
		global.trustme_interval = setInterval(trustme.postTrustme, getRandomInt(2000,4000),0,my_address,headlessWallet.signer);
	}
}