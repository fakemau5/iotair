'use strict';

const config = require('config');
const epd = require('epd2in7b');
const EventEmitter = require('events');
const path = require('path');
const qr = require('qr-image');
const {EVENT_BTN_ONOFF_PRESSED} = require('./constants');
const {formatBalance} = require('./utils');

const font = path.join(__dirname, '..', 'res', 'fonts', 'Roboto-Regular.ttf');

class PhysicalInterface extends EventEmitter {
    constructor(state) {
        super();
        this.width = epd.height;
        this.height = epd.width;
        this.state = state;

        epd.buttons.handler.then((handler) => {
            const self = this;
            handler.on('pressed', function(button) {
                switch (button) {
                    case epd.buttons.button1:
                        self.emit(EVENT_BTN_ONOFF_PRESSED, null);
                        break;
                }
            });
        });
    }

    async start() {
        console.log('Starting physical interface...');
        await this.splashMessage('logo.png');
    }

    async splashMessage(image, text) {
        this.splashImage = image;
        this.splashText = text;
        await this.refreshDisplay();
    }

    async refreshDisplay() {
        console.log('Physical interface: display refreshing...');
        if (this.displayUpdating) {
            this.forceDisplayRefresh = true;
            return;
        }
        this.displayUpdating = true;
        await epd.init({fastLut: true});
        const sb = await epd.getImageBuffer('landscape');
        sb.filledRectangle(0, 0, this.width, this.height, epd.colors.white);

        if (this.splashImage || this.splashText) {
            if (this.splashImage) {
                const imgBuffer = await epd.gd.createFromPng(path.join(__dirname, '..', 'res', 'images', this.splashImage));
                await imgBuffer.copy(sb, 57, 13, 0, 0, imgBuffer.width, imgBuffer.height);
            }
            if (this.splashText) {
                // Retrieve bounding box of displayed string
                const fontSize = 12;
                const [xll, yll, xlr, ylr, xur, yur, xul, yul] = sb.stringFTBBox(epd.colors.black, font, fontSize, 0, 0, 0, this.splashText);
                sb.stringFT(epd.colors.black, font, fontSize, 0, Math.round(this.width / 2 - (xur - xul) / 2), 150, this.splashText);
            }
            this.splashImage = null;
            this.splashText = null;
        } else {
            // QR
            if (this.state.address !== null) {
                const qrPng = qr.imageSync(this.state.address, {
                    type: 'png',
                    margin: 1,
                    size: 3,
                });
                const qrBuffer = epd.gd.createFromPngPtr(qrPng);
                qrBuffer.copy(sb, 140, 15, 0, 0, qrBuffer.width, qrBuffer.height);
            }

            // Example:
            // gd.Image#stringFT(color, font, size, angle, x, y, string, boundingbox)

            // Status
            if (this.state.status !== null) {
                sb.stringFT(epd.colors.black, font, 10, 0, 20, 35, 'status');
                sb.stringFT(epd.colors.black, font, 30, 0, 20, 75, this.state.status);
            }
            // Temp
            if (this.state.temperature !== null) {
                sb.stringFT(epd.colors.black, font, 10, 0, 20, 110, 'room temp');
                sb.stringFT(epd.colors.black, font, 30, 0, 20, 150, `${this.state.temperature}°`);
            }
            // Balance
            if (this.state.balance !== null) {
                sb.stringFT(
                    epd.colors.black,
                    font,
                    15,
                    0,
                    140,
                    145,
                    `${formatBalance(this.state.balance)} (${Math.floor(this.state.balance / config.airconditioner.tickCost) *
                        Math.floor(config.airconditioner.tickDuration / 60000)} min)`
                );
                sb.stringFT(
                    epd.colors.black,
                    font,
                    10,
                    0,
                    140,
                    165,
                    `fee: ${formatBalance(config.airconditioner.tickCost)} / ${Math.floor(config.airconditioner.tickDuration / 60000)} min`
                );
            }
        }

        await epd.displayImageBuffer(sb);
        await epd.sleep();
        this.displayUpdating = false;
        if (this.forceDisplayRefresh) {
            this.forceDisplayRefresh = false;
            await this.refreshDisplay();
        }
    }

    async dispose() {
        const sb = await epd.getImageBuffer('landscape');
        await sb.destroy();
    }
}

module.exports = PhysicalInterface;