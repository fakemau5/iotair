'use strict';

const {convertUnits} = require('@iota/unit-converter');

module.exports.formatBalance = (balance) => {
    let toUnit;
    if (balance >= 1000000000000000) {
        toUnit = 'Pi';
    } else if (balance >= 1000000000000) {
        toUnit = 'Ti';
    } else if (balance >= 1000000000) {
        toUnit = 'Gi';
    } else if (balance >= 1000000) {
        toUnit = 'Mi';
    } else if (balance >= 1000) {
        toUnit = 'Ki';
    } else {
        toUnit = 'i';
    }
    return `${convertUnits(balance, 'i', toUnit)} ${toUnit}`;
};
