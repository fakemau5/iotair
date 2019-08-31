'use strict';

const axios = require('axios');
const EventEmitter = require('events');
const config = require('config');
const {EVENT_STATE_CHANGED, STATUS_OFF, STATUS_ON} = require('./constants');

class AirConditionerRemoteController extends EventEmitter {
    constructor(baseUrl, state) {
        super();
        this.baseUrl = baseUrl;
        this.state = state;
    }

    async turnOn() {
        console.log('Remote contoller: turning on air conditioner...');
        if (config.airconditioner.enabled) {
            // Sets the air conditioner in automatic mode, to gain a 25°C room temperature
            // see: https://github.com/ael-code/daikin-control for other APIs ad settings
            await axios.post(`${this.baseUrl}/aircon/set_control_info?pow=1&mode=7&stemp=25&shum=0&f_rate=A&f_dir=0`);
        }
        console.log('Remote contoller: air conditioner turned on');
        this.state.status = STATUS_ON;
        this.emit(EVENT_STATE_CHANGED);
    }

    async turnOff() {
        console.log('Remote contoller: turning off air conditioner...');
        if (config.airconditioner.enabled) {
            await axios.post(`${this.baseUrl}/aircon/set_control_info?pow=0&mode=2&stemp=26&shum=0&f_rate=A&f_dir=0`);
        }
        console.log('Remote contoller: air conditioner turned off');
        this.state.status = STATUS_OFF;
        this.emit(EVENT_STATE_CHANGED);
    }
}

module.exports = AirConditionerRemoteController;
