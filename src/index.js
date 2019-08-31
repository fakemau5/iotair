'use strict';

const config = require('config');
const {EVENT_STATE_CHANGED, EVENT_PROCESSING, EVENT_BTN_ONOFF_PRESSED, EVENT_PAID, EVENT_UNPAID, EVENT_TICK, STATUS_OFF, STATUS_ON} = require('./constants');
const AirConditionerRemoteController = require('./airConditionerRemoteController');
const Thermometer = require('./thermometer');
const PhysicalInterface = require('./physicalInterface');
const PaymentManager = require('./paymentManager');
const Server = require('./server');

const state = {
    status: null,
    temperature: null,
    balance: null,
    address: null,
};

const airConditionerRemoteController = new AirConditionerRemoteController(config.get('airconditioner.baseUrl'), state);
const thermometer = new Thermometer(config.get('airconditioner.baseUrl'), state);
const physicalInterface = new PhysicalInterface(state);
const paymentManager = new PaymentManager(state);
const webServer = new Server(state);

airConditionerRemoteController.on(EVENT_STATE_CHANGED, () => physicalInterface.refreshDisplay());
paymentManager.on(EVENT_STATE_CHANGED, () => physicalInterface.refreshDisplay());
thermometer.on(EVENT_STATE_CHANGED, () => physicalInterface.refreshDisplay());

paymentManager.on(EVENT_PROCESSING, () => physicalInterface.splashMessage('wait.png', 'PROCESSING PAYMENT'));
paymentManager.on(EVENT_TICK, () => paymentManager.payTick());
physicalInterface.on(EVENT_BTN_ONOFF_PRESSED, async () => {
    switch (state.status) {
        case STATUS_OFF:
            await physicalInterface.splashMessage('wait.png', 'PROCESSING PAYMENT');
            if (await paymentManager.payTick()) {
                await airConditionerRemoteController.turnOn();
                paymentManager.startBilling();
            }
            break;
        case STATUS_ON:
            await airConditionerRemoteController.turnOff();
            paymentManager.stopBilling();
            break;
    }
});
paymentManager.on(EVENT_PAID, async () => {
    physicalInterface.refreshDisplay();
    paymentManager.walletInfo();
    return;
});
paymentManager.on(EVENT_UNPAID, async () => {
    await physicalInterface.splashMessage('denied.png', 'INSUFFICIENT CREDIT');
    await airConditionerRemoteController.turnOff();
    paymentManager.stopBilling();
    return;
});

physicalInterface.start();
setTimeout(() => {
    airConditionerRemoteController.turnOff();
}, 6000);
setTimeout(() => {
    thermometer.start();
}, 12000);
setTimeout(() => {
    paymentManager.start();
}, 18000);
setTimeout(() => {
    webServer.start();
}, 24000);

const dispose = () => {
    console.log('Shutting down...');
    physicalInterface.dispose();
    paymentManager.dispose();
    webServer.dispose();
    thermometer.dispose();
};

process.once('SIGINT', dispose).on('uncaughtException', (err) => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
});
