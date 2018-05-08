'use strict';
var conf=require('./conf.js');
var blake2 = require('blake2');
var composer=require('trustnote-common/composer.js');
var network=require('trustnote-common/network.js');
// var headlessWallet = require('trustnote-headless');

function onError(err){
    console.error(err);
}

function startEquihash(address,nxtRndNum,signer){
    console.info("start equihash for",nxtRndNum);
    global.solution=genSolution(address);
    composer.composeEquihashJoint(address,nxtRndNum,"I'm seed",100,global.solution,signer,composer.getSavingCallbacks({
        ifNotEnoughFunds: onError,
        ifError: onError,
        ifOk: function(objJoint){
            process.nextTick(network.broadcastJoint,objJoint);
        }
    }));
}

function genSolution(address){
    var h = blake2.createHash('blake2b', {digestLength: 16});
    h.update(new Buffer(address));
    var solution=h.digest().toString(); 
    return solution;
}

exports.startEquihash=startEquihash