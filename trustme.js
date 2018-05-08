"use strict";

var process=require('process'); 
var composer=require('trustnote-common/composer.js');
var network = require('trustnote-common/network.js');
var conf=require('./conf.js');
// const headlessWallet = require('trustnote-headless');

function postTrustme(rndNum,address,signer) {
    console.info("start to post trustme unit for round",rndNum,"solution is", global.solution);
    
    var callbacks = composer.getSavingCallbacks({
        ifNotEnoughFunds: function(err) {
            console.error(err);
        },
        ifError: function(err) {
            console.error(err);
        },
        ifOk: function(objJoint) {
            network.broadcastJoint(objJoint);
        }
    });

    composer.composeTrustmeJoint(address, rndNum,global.solution, signer, callbacks);
}

exports.postTrustme=postTrustme