/*jslint node: true */
"use strict";

exports.port = 6616;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bServeAsSuperNode=true;
exports.bLight = false;

exports.storage = 'sqlite';
exports.admin_email='witness';
exports.from_email='witness';
exports.WS_PROTOCOL = 'ws://';
exports.hub = 'h1:6616';
exports.deviceName = 'Witness';
exports.permanent_pairing_secret = 'randomstring';
exports.control_addresses = ['DEVICE ALLOWED TO CHAT'];
exports.payout_address = 'WHERE THE MONEY CAN BE SENT TO';

exports.bSingleAddress = true;
exports.THRESHOLD_DISTANCE = 10;
exports.MIN_AVAILABLE_WITNESSINGS = 100;

exports.KEYS_FILENAME = 'keys.json';


exports.deposite_amount=50000;

exports.lock_time=17280;

//exports.payout_addr=null;
//exports.reward_addr=null;

console.log('finished witness conf');
