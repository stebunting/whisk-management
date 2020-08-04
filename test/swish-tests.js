// Page Tag
const tag = 'whisk-management:swish-tests';

// Requirements
const assert = require('assert');
const {
  parseSwishAlias,
  getSwishID,
  createPaymentRequest,
  retrievePaymentRequest,
  createRefund,
  retrieveRefund
} = require('../lib/swish/swish')(true);
const {
  connect,
  disconnect
} = require('../lib/db-control/db-control')(tag, 'whisk-management-test');

describe('Swish Integration Tests', () => {
  describe('Test Helpers', () => {
    it('converts telephone number to alias', async () => {
      assert.equal(parseSwishAlias('0731365331'), '46731365331');
      assert.equal(parseSwishAlias('+46731365331'), '46731365331');
      assert.equal(parseSwishAlias('+460665786'), '46665786');
      assert.equal(parseSwishAlias('+46 73-136 53 31'), '46731365331');
      assert.equal(parseSwishAlias('+46 (0) 72-476 88 97'), '46724768897');
    });

    it('generates valid Swish id', () => {
      const re = /^[0-9A-F]{32}$/;
      for (let i = 0; i < 100; i += 1) {
        const id = getSwishID();
        assert.equal(id.length, 32);
        assert.ok(re.test(id));
      }
    });

    it('creates and retrieves valid payment request', async () => {
      const options = {
        payerTelephone: '076557189245',
        amount: 50000
      };
      const response = await createPaymentRequest(options);
      assert.equal(response.status, 'OK');
      assert.equal(response.data.payerAlias, '4676557189245');
      assert.equal(response.data.amount, 500);

      const retrievedRequest = await retrievePaymentRequest(response.data.id);
      assert.equal(retrievedRequest.id, response.data.id);
      assert.equal(retrievedRequest.payerAlias, response.data.payerAlias);
      assert.equal(retrievedRequest.amount, 500);
      assert.equal(retrievedRequest.status, 'CREATED');
    });

    it('connects to db for logging', () => {
      connect();
    });

    it('returns error on invalid swish alias', async () => {
      const options = {
        payerTelephone: '073328346012435',
        amount: 10000
      };
      const response = await createPaymentRequest(options);
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'BE18');
    });

    it('returns error on amount less than 1 SEK', async () => {
      const options = {
        payerTelephone: '0733283460',
        amount: 99
      };
      const response = await createPaymentRequest(options);
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'AM06');
    });

    it('returns error on amount more than 999999999999.99 SEK', async () => {
      const options = {
        payerTelephone: '0733283460',
        amount: 100000000000000
      };
      const response = await createPaymentRequest(options);
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'AM02');
    });

    it('returns error message on invalid payment request', async () => {
      const response = await retrievePaymentRequest(getSwishID());
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'RP04');
    });

    it('creates refund request', async () => {
      const refundOptions = {
        paymentReference: 'GENERICREF',
        amount: 20000
      };
      const response = await createRefund(refundOptions);
      assert.equal(response.status, 'OK');
      const re = /^[0-9A-F]{32}$/;
      assert.ok(re.test(response.data.id));
    });

    it('returns error on refund amount less than 1 SEK', async () => {
      const refundOptions = {
        paymentReference: 'GENERICREF',
        amount: 99
      };
      const response = await createRefund(refundOptions);
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'AM06');
    });

    it('returns error on refund amount more than 999999999999.99 SEK', async () => {
      const refundOptions = {
        paymentReference: 'GENERICREF',
        amount: 100000000000000
      };
      const response = await createRefund(refundOptions);
      assert.equal(response.status, 'Error');
      assert.equal(response.errors[0], 'AM02');
    });

    it('creates and retrieves refund request', async () => {
      const refundOptions = {
        paymentReference: 'GENERICREF',
        amount: 20000
      };
      const refundResponse = await createRefund(refundOptions);
      assert.equal(refundResponse.status, 'OK');
      const { id: refundId } = refundResponse.data;

      const response = await retrieveRefund(refundId);
      assert.equal(response.id, refundId);
      assert.equal(response.originalPaymentReference, refundOptions.paymentReference);
      assert.equal(response.amount, 200);
      assert.equal(response.status, 'CREATED');
    });

    it('disconnects from db', () => {
      disconnect();
    });
  });
});
