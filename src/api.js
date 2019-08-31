'use strict';

const createRouter = require('express-promise-router');

module.exports = (state) => {
    const router = createRouter();

    router.get('/ac', async (req, res) => {
        res.status(200).send(state);
    });

    router.post('/ac/on', async (req, res) => {
        res.status(200).send('OK');
    });

    router.post('/ac/off', async (req, res) => {
        res.status(200).send('OK');
    });

    return router;
};
