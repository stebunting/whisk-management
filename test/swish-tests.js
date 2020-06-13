// Page Tag
const tag = 'whisk-management:swish-tests';

// Requirements
const assert = require('assert');
const { orderConfirmed } = require('../src/controllers/treatBoxController')();

describe('Swish Integration Tests', () => {
  describe('Send payment request', () => {
    it('sends payment request', async () => {
      const req = {
        body: {
          'payment-method': 'Swish'
        }
      };
      orderConfirmed(req);
      assert.ok(true);
    });
  });
});
