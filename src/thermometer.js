'use strict';

const axios = require('axios');
const EventEmitter = require('events');
const {EVENT_STATE_CHANGED, THERMOMETER_MEASURE_INTERVAL} = require('./constants');

class Thermometer extends EventEmitter {
    constructor(baseUrl, state) {
        super();
        this.baseUrl = baseUrl;
        this.state = state;
    }

    async measure() {
        console.log('Thermometer: measuring...');
        let temperature;
        try {
            const res = await axios.get(`${this.baseUrl}/aircon/get_sensor_info`);
            const matchHtemp = res.data.match(/htemp=(\d+[,.]{1}\d*)/);
            if (matchHtemp) {
                temperature = parseFloat(matchHtemp[1]);
            }
        } catch (err) {
            temperature = -273;
        }

        console.log(`Thermometer: ${temperature}`);
        if (this.state.temperature !== temperature) {
            this.state.temperature = temperature;
            this.emit(EVENT_STATE_CHANGED);
        }
    }

    async start() {
        console.log('Thermometer: starting...');
        this.measure();
        this.dataInterval = setInterval(() => {
            this.measure();
        }, THERMOMETER_MEASURE_INTERVAL);
    }

    dispose() {
        if (this.dataInterval !== undefined) {
            clearInterval(this.dataInterval);
        }
    }
}

module.exports = Thermometer;
