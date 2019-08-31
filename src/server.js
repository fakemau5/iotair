'use strict';

const config = require('config');
const createRoutes = require('./routes');
const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');

class Server {
    constructor(state, physicalInterface) {
        this.app = express();
        this.app.set('port', config.get('server.port'));
        this.app.use(express.static(path.join(__dirname, '..', 'res')));
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '..', 'res', 'views'));
        const users = {};
        users[config.get('server.user')] = config.get('server.password');
        this.app.use(basicAuth({users, challenge: true, realm: 'I0t41r'}));
        this.app.use('/', createRoutes(state, physicalInterface));
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
