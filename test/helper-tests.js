// Requirements
const assert = require('assert');
const {
  priceFormat,
  parseMarkers,
  calculateMoms,
  calculateNetCost,
  dateFormat
} = require('../src/functions/helper');

describe('Helper Tests', () => {
  describe('Functions', () => {
    it('converts price', () => {
      assert.equal(priceFormat(1000), '10 SEK');
      assert.equal(priceFormat(786), '8 SEK');
      assert.equal(priceFormat(786, { includeOre: true }), '7.86 SEK');
      assert.equal(priceFormat(1, { includeOre: true }), '0.01 SEK');
      assert.equal(priceFormat(), '0 SEK');
      assert.equal(priceFormat(0, { includeSymbol: false }), '0');
      assert.equal(priceFormat(123456789), '1234568 SEK');
      assert.equal(priceFormat(123456789, { includeSymbol: false }), '1234568');
      assert.equal(priceFormat(12345678901234567, { includeSymbol: false }), '123456789012346');
    });

    it('parses date', () => {
      assert.equal(dateFormat('2020-32-3', { parseCode: true }), 'Wednesday 5th August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z'), 'Monday 3rd August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'short' }), '2020/8/3 9:22:40pm');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'date' }), '3/8/2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'dateFormatter' }), '2020-08-03');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'time' }), '9:22 PM');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'long' }), 'Monday 3rd August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'long', includeWeek: true }), 'Monday 3rd August 2020 (Week 32)');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'invalid' }), 'Monday 3rd August 2020');
    });

    it('calculates MOMs', () => {
      assert.equal(calculateMoms(112.26, 12).toFixed(2), '12.03');
      assert.equal(calculateMoms(1300.83, 12).toFixed(2), '139.37');
      assert.equal(calculateMoms(10.25, 25).toFixed(2), '2.05');
      assert.equal(calculateMoms(1798.98, 0).toFixed(2), '0.00');
      assert.equal(calculateMoms(1798.98, 25).toFixed(2), '359.80');
    });

    it('calculates net cost', () => {
      assert.equal(calculateNetCost(112, 12).toFixed(2), '100.00');
    });
  });

  describe('Parse Markers', () => {
    it('parses markers', () => {
      const recipient = {
        items: {
          comboBoxes: 0,
          treatBoxes: 1,
          vegetableBoxes: 0
        },
        details: {
          name: 'Stephen Bunting'
        },
        delivery: {
          message: 'This is a message for you.'
        }
      };

      let str = 'Hi %name, hello.';
      assert.equal(parseMarkers(str, recipient), 'Hi Stephen Bunting, hello.');

      str = 'Thanks for the order.%message';
      assert.equal(parseMarkers(str, recipient), 'Thanks for the order.\nThis is a message for you.\n');

      str = 'Thanks for the order.';
      assert.equal(parseMarkers(str, recipient), 'Thanks for the order.');

      str = 'Your %order from Whisk is on the way.';
      assert.equal(parseMarkers(str, recipient), 'Your Treat Box from Whisk is on the way.');

      recipient.items.comboBoxes = 1;
      str = 'Your %order from Whisk is on the way.';
      assert.equal(parseMarkers(str, recipient), 'Your Veggie & Treat Boxes from Whisk is on the way.');

      recipient.items.treatBoxes = 0;
      str = 'Your %order from Whisk is on the way.';
      assert.equal(parseMarkers(str, recipient), 'Your Veggie & Treat Box from Whisk is on the way.');
    });
  });
});
