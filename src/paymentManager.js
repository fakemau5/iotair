'use strict';

const {composeAPI, generateAddress} = require('@iota/core');
const config = require('config');
const EventEmitter = require('events');
const zmq = require('zeromq');
const {EVENT_STATE_CHANGED, EVENT_PROCESSING, EVENT_TICK, EVENT_UNPAID, EVENT_PAID} = require('./constants');

// Function to remove the checksum from a 90-char IOTA address
const stripChecksum = (addr) => addr.substr(0, 81);

class PaymentManager extends EventEmitter {
    constructor(state) {
        super();
        this.state = state;
        this.socket = zmq.socket('sub');
        this.socket.on('message', async (msg) => {
            // Update the balance upon receiving one or more transactions towards the unit address
            console.log('Payment manager: transaction notified...');
            this.emit(EVENT_PROCESSING);
            const data = msg.toString().split(' ');
            const txs = await this.provider.getTransactionObjects([data[1]]);
            txs.forEach((tx) => (this.state.balance += tx.value));
            this.emit(EVENT_STATE_CHANGED);
        });
    }

    async start() {
        console.log('Starting payment manager...');
        this.state.balance = 0;
        this.provider = await composeAPI({
            provider: config.get('iota.nodeUri'),
        });
        await this.socket.connect(config.iota.nodeZmqUri);
        await this.walletInfo();
    }

    async walletInfo() {
        console.log('Payment manager: getting new receiving address...');
        // Deterministic address generation to improve performances. When the total
        // balance of that address will be transferred this address can be changed or
        // just configure a different seed for the unit (it will be impossible to
        // send money to an address with an outgoing transaction).
        const address = generateAddress(config.iota.seed, 0, 2, true);
        console.log(`Payment manager: address is ${address}`);
        if (this.state.address !== address) {
            this.state.address = address;
            this.emit(EVENT_STATE_CHANGED);
            await this.socket.subscribe(stripChecksum(this.state.address));
            console.log(`Payment manager: subscribed to ${stripChecksum(this.state.address)} updates...`);
        }
    }

    startBilling() {
        console.log('Payment manager: billing started...');
        this.creditsInterval = setInterval(() => {
            this.emit(EVENT_TICK);
        }, config.airconditioner.tickDuration);
    }

    stopBilling() {
        console.log('Payment manager: billing stopped...');
        if (this.creditsInterval !== undefined) {
            clearInterval(this.creditsInterval);
        }
    }

    async payTick() {
        console.log(`Payment manager: paying current tick (${config.airconditioner.tickCost} i)...`);
        if (this.state.balance - config.airconditioner.tickCost < 0) {
            this.emit(EVENT_UNPAID);
            return false;
        }
        this.state.balance = this.state.balance - config.airconditioner.tickCost;
        this.emit(EVENT_PAID);
        return true;
    }

    async dispose() {
        if (this.creditsInterval !== undefined) {
            clearInterval(this.creditsInterval);
        }
    }
}

module.exports = PaymentManager;
