// Page Tag
const tag = 'whisk-management:swish-tests';

// Requirements
const assert = require('assert');
const { parseSwishAlias, orderConfirmed } = require('../src/controllers/treatBoxController')();

describe('Swish Integration Tests', () => {
  describe('Send payment request', () => {
    it('converts telephone number to alias', async () => {
      assert.equal(parseSwishAlias('0731365331'), '46731365331');
      assert.equal(parseSwishAlias('+46731365331'), '46731365331');
      assert.equal(parseSwishAlias('+460665786'), '46665786');
      assert.equal(parseSwishAlias('+46 73-136 53 31'), '46731365331');
      assert.equal(parseSwishAlias('+46 (0) 72-476 88 97'), '46724768897');
    });
  });
});
