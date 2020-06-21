// Page Tag
const tag = 'whisk-management:helper-tests';

// Requirements
const assert = require('assert');
const { parseMarkers } = require('../src/functions/helper');

describe('Helper Tests', () => {
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
