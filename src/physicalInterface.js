'use strict';

const config = require('config');
const epd = require('epd2in7b');
const EventEmitter = require('events');
const path = require('path');
const qr = require('qr-image');
const {EVENT_BTN_ONOFF_PRESSED} = require('./constants');
const {formatBalance} = require('./utils');

const font = path.join(__dirname, '..', 'res', 'fonts', 'Roboto-Regular.ttf');

// Utils functions to invert colors of the QR to fix rendering on e-ink
function coord2offset(x, y, size) {
    return (size + 1) * y + x + 1;
}
function invertColors(bitmap) {
    const size = bitmap.size;
    const data = bitmap.data;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const offset = coord2offset(x, y, size);
            data[offset] = Math.abs(data[offset] - 255);
        }
    }
}

class PhysicalInterface extends EventEmitter {
    constructor(state) {
        super();
        this.width = epd.height;
        this.height = epd.width;
        this.state = state;

        // Emit an event when button is pressed
        epd.buttons.handler.then((handler) => {
            handler.on('pressed', (button) => {
                switch (button) {
                    case epd.buttons.button1:
                        this.emit(EVENT_BTN_ONOFF_PRESSED, null);
                        break;
                }
            });
        });
    }

    async start() {
        console.log('Starting physical interface...');
        await this.splashMessage('logo.png');
    }

    // Fire the button pressed event programmatically (when using the web interface)
    async fireButtonEvent() {
        this.emit(EVENT_BTN_ONOFF_PRESSED, null);
    }

    // Display a fullscreen image with an optional message
    async splashMessage(image, text) {
        this.splashImage = image;
        this.splashText = text;
        await this.refreshDisplay();
    }

    // Update display information
    async refreshDisplay() {
        console.log('Physical interface: display refreshing...');
        if (this.displayUpdating) {
            // Display refreshing is slow and two or more refresh instructions may collide.
            // This ensure always a proper rendering
            this.forceDisplayRefresh = true;
            return;
        }
        this.displayUpdating = true;
        await epd.init({fastLut: true});
        const sb = await epd.getImageBuffer('landscape');
        sb.filledRectangle(0, 0, this.width, this.height, epd.colors.white);

        // Render spash image and message
        if (this.splashImage || this.splashText) {
            if (this.splashImage) {
                const imgBuffer = await epd.gd.createFromPng(path.join(__dirname, '..', 'res', 'images', this.splashImage));
                await imgBuffer.copy(sb, 57, 13, 0, 0, imgBuffer.width, imgBuffer.height);
            }
            if (this.splashText) {
                // Retrieve bounding box of displayed string
                const fontSize = 12;
                const [, , , , xur, , xul] = sb.stringFTBBox(epd.colors.black, font, fontSize, 0, 0, 0, this.splashText);
                sb.stringFT(epd.colors.black, font, fontSize, 0, Math.round(this.width / 2 - (xur - xul) / 2), 150, this.splashText);
            }
            this.splashImage = null;
            this.splashText = null;
        } else {
            // Render display information
            // QR with deposit address
            if (this.state.address !== null) {
                const qrPng = qr.imageSync(this.state.address, {
                    type: 'png',
                    margin: 1,
                    size: 3,
                    customize: invertColors,
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
                sb.stringFT(epd.colors.black, font, 30, 0, 20, 150, `${this.state.temperature}°C`);
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
                const tickMinutes = Math.floor(config.airconditioner.tickDuration / 60000);
                const tickIntervalLabel = tickMinutes > 1 ? `${tickMinutes} min` : 'min';
                sb.stringFT(epd.colors.black, font, 10, 0, 140, 165, `fee: ${formatBalance(config.airconditioner.tickCost)} / ${tickIntervalLabel}`);
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
