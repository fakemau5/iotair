'use strict';

const config = require('config');
const createApi = require('./api');

const express = require('express');

class Server {
    constructor(state) {
        this.app = express();
        this.app.set('port', config.get('server.port'));
        this.app.use('/', createApi(state));
    }

    async start() {
        console.log('Starting web server...');
        this.server = this.app.listen(this.app.get('port'), () => {
            console.log(`Web server: started on port ${this.app.get('port')}`);
        });
    }

    dispose() {
        if (this.server !== undefined) {
            this.server.close();
            this.server = undefined;
        }
    }
}

module.exports = Server;
