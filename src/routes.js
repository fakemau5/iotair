'use strict';

const createRouter = require('express-promise-router');

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

module.exports = (state, physicalInterface) => {
    const router = createRouter();

    router.get('/', async (req, res) => {
        res.render('index.ejs', state);
    });

    // Act as if pressing the physical button
    router.post('/ac/toggle', async (req, res) => {
        physicalInterface.fireButtonEvent();
        await sleep(5000);
        res.redirect('/');
    });

    return router;
};
