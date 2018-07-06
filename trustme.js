"use strict";

var process = require('process');
var composer = require('trustnote-common/composer.js');
var network = require('trustnote-common/network.js');
var db = require('trustnote-common/db.js');
var conf = require('./conf.js');
// const headlessWallet = require('trustnote-headless');

function postTrustme(rndNum, address, signer) {
	// db.query("select 1 from units join unit_authors on units.unit=unit_authors.unit join \n\
    // trustme on trustme.unit=units.unit \n\
    //  where units.main_chain_index is null and unit_authors.address=? and trustme.rnd_num=? limit 1",[address,rndNum],  function (rows) {
	// 	if (rows.length === 0) {
			console.info("start to post trustme unit for round", rndNum, "solution is", global.solution);
			var callbacks = composer.getSavingCallbacks({
				ifNotEnoughFunds: function (err) {
					console.error(err);
				},
				ifError: function (err) {
					console.error(err);
				},
				ifOk: function (objJoint) {
					network.broadcastJoint(objJoint);
				}
			});

			composer.composeTrustmeJoint(address, rndNum, global.solution, signer, callbacks);
	// 	}
	// });

	
}

exports.postTrustme = postTrustme