'use strict';

const {composeAPI} = require('@iota/core');
const config = require('config');
const EventEmitter = require('events');
const zmq = require('zeromq');
const {EVENT_STATE_CHANGED, EVENT_PROCESSING, EVENT_TICK, EVENT_UNPAID, EVENT_PAID} = require('./constants');

const stripChecksum = (addr) => addr.substr(0, 81);

class PaymentManager extends EventEmitter {
    constructor(state) {
        super();
        this.state = state;
        this.socket = zmq.socket('sub');
        this.socket.on('message', async (msg) => {
            console.log('Payment manager: transaction notified...');
            this.state.address = null;
            this.emit(EVENT_PROCESSING);
            this.walletInfo();
        });
    }

    async walletInfo() {
        console.log('Payment manager: getting account info...');
        const accountData = await this.provider.getAccountData(config.iota.seed);
        console.log(`Payment manager: balance is ${accountData.balance} i`);
        if (this.state.balance !== accountData.balance) {
            this.state.balance = accountData.balance;
            this.emit(EVENT_STATE_CHANGED);
        }

        console.log('Payment manager: getting new receiving address...');
        const address = await this.provider.getNewAddress(config.iota.seed, {checksum: true});
        console.log(`Payment manager: new address is ${address}`);
        if (this.state.address !== address) {
            this.state.address = address;
            this.emit(EVENT_STATE_CHANGED);
            await this.socket.subscribe(stripChecksum(this.state.address));
            console.log(`Payment manager: subscribed to ${stripChecksum(this.state.address)} updates...`);
        }
    }

    async start() {
        console.log('Starting payment manager...');
        this.provider = await composeAPI({
            provider: config.get('iota.nodeUri'),
        });
        await this.socket.connect(config.iota.nodeZmqUri);
        await this.walletInfo();
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
        const transfers = [
            {
                address: config.iota.recipientAddress,
                value: config.airconditioner.tickCost,
                tag: 'IOTAIRTICK',
            },
        ];
        const depth = 3;
        const minWeightMagnitude = 9; // devnet
        let payment = false;
        try {
            const trytes = await this.provider.prepareTransfers(config.iota.seed, transfers, {});
            const bundle = await this.provider.sendTrytes(trytes, depth, minWeightMagnitude);
            console.log(`Payment manager: published transaction with tail hash: ${bundle[0].hash}`);
            await this.socket.unsubscribe(stripChecksum(this.state.address));
            console.log(`Payment manager: unsubscribed from to ${stripChecksum(this.state.address)} updates...`);
            this.state.address = null;
            this.state.balance -= config.airconditioner.tickCost;
            this.emit(EVENT_PAID);
            payment = bundle[0].hash;
        } catch (err) {
            console.log('Payment manager: insufficient credit, transaction failed');
            this.emit(EVENT_UNPAID);
        }
        return payment;
    }

    async dispose() {
        if (this.creditsInterval !== undefined) {
            clearInterval(this.creditsInterval);
        }
    }
}

module.exports = PaymentManager;
