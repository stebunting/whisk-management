// Page Tag
const tag = 'whisk-management:swish';

// Requirements
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const debug = require('debug')(tag);
const { logError } = require('../db-control')();
const { priceFormat } = require('../../src/helpers');

// Test Constants
const callbackRoot = 'https://whisk-management.herokuapp.com';

const swishTest = {
  alias: '1234679304',
  baseUrl: 'https://mss.cpc.getswish.net/swish-cpcapi',
  callbackRoot,
  httpsAgent: new https.Agent({
    cert: fs.readFileSync('cert/test.pem'),
    key: fs.readFileSync('cert/test.key'),
    ca: fs.readFileSync('cert/test-ca.pem'),
    passphrase: 'swish'
  })
};

const swishProduction = {
  alias: process.env.SWISH_ALIAS,
  baseUrl: 'https://cpc.getswish.net/swish-cpcapi',
  callbackRoot,
  httpsAgent: new https.Agent({
    cert: Buffer.from(JSON.parse(`"${process.env.SWISH_CERT}"`)),
    key: Buffer.from(JSON.parse(`"${process.env.SWISH_KEY}"`))
  })
};

function swishController(test = false) {
  // Determine which Swish Credentials to use
  const swish = (test ? swishTest : swishProduction);

  // Function to return a UUID suitable for Swish (32 characters, no dashes, capitals)
  function getSwishID() {
    return uuidv4().replace(/-/g, '').toUpperCase();
  }

  // Function to convert inserted phone number to Swish alias
  function parseSwishAlias(telephone) {
    let alias = telephone.replace(/\D/g, '');
    if (alias.charAt(0) === '0') {
      alias = `46${alias.substring(1)}`;
    } else if (alias.substring(0, 2) === '46') {
      if (alias.charAt(2) === '0') {
        alias = `46${alias.substring(3)}`;
      } else {
        alias = `46${alias.substring(2)}`;
      }
    }
    return alias;
  }

  // Create Payment Request
  async function createPaymentRequest({ payerTelephone, amount }) {
    const id = getSwishID();
    const apiConfig = {
      method: 'put',
      url: `${swish.baseUrl}/api/v2/paymentrequests/${id}`,
      httpsAgent: swish.httpsAgent,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        callbackUrl: `${swish.callbackRoot}/treatbox/swishcallback`,
        payeeAlias: swish.alias,
        payerAlias: parseSwishAlias(payerTelephone),
        amount: parseInt(priceFormat(amount, { includeSymbol: false, includeOre: true }), 10),
        currency: 'SEK',
        message: 'WHISK.se Order'
      }
    };

    try {
      await axios(apiConfig);
      return {
        status: 'OK',
        data: {
          payerAlias: apiConfig.data.payerAlias,
          id,
          amount: apiConfig.data.amount
        }
      };
    } catch (error) {
      logError({
        message: `Error sending Swift payment request (${id})`,
        details: JSON.stringify(apiConfig.data),
        error: error.stack
      });
      let errors = ['ERROR'];
      if (error.response && error.response.data.length > 0) {
        errors = error.response.data.map((x) => x.errorCode);
      }
      return {
        status: 'Error',
        errors
      };
    }
  }

  // Create Refund
  async function createRefund({ paymentReference, amount }) {
    const id = getSwishID();
    const apiConfig = {
      method: 'put',
      url: `${swish.baseUrl}/api/v2/refunds/${id}`,
      httpsAgent: swish.httpsAgent,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        originalPaymentReference: paymentReference,
        callbackUrl: `${swish.callbackRoot}/treatbox/swishrefundcallback`,
        payerAlias: swish.alias,
        amount: parseInt(priceFormat(amount, { includeSymbol: false, includeOre: true }), 10),
        currency: 'SEK',
        message: ''
      }
    };

    try {
      await axios(apiConfig);
      return {
        status: 'OK',
        data: {
          id
        }
      };
    } catch (error) {
      logError({
        message: `Error creating Swift refund (${paymentReference})`,
        details: JSON.stringify(apiConfig.data),
        error: error.stack
      });
      let errors = ['ERROR'];
      if (error.response && error.response.data.length > 0) {
        errors = error.response.data.map((x) => x.errorCode);
      }
      return {
        status: 'Error',
        errors
      };
    }
  }

  // Function to make a generic Swish API Call
  async function makeAPICall(config) {
    const swishApiConfig = {
      method: config.method,
      url: `${swish.baseUrl}${config.endpoint}`,
      httpsAgent: swish.httpsAgent,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    try {
      const response = await axios(swishApiConfig);
      return response.data;
    } catch (error) {
      logError({
        message: config.errorMessage,
        details: '',
        error: error.stack
      });
      let errors = ['ERROR'];
      if (error.response && error.response.data.length > 0) {
        errors = error.response.data.map((x) => x.errorCode);
      }
      return {
        status: 'Error',
        errors
      };
    }
  }

  // Retrieve Payment Request
  async function retrievePaymentRequest(requestId) {
    return makeAPICall({
      method: 'get',
      endpoint: `/api/v1/paymentrequests/${requestId}`,
      errorMessage: 'Error calling Swish API to retrieve payment request result'
    });
  }

  // Retrieve Refund Request
  async function retrieveRefund(refundId) {
    return makeAPICall({
      method: 'get',
      endpoint: `/api/v1/refunds/${refundId}`,
      errorMessage: 'Error calling Swish API to retrieve refund result'
    });
  }

  return {
    getSwishID,
    parseSwishAlias,
    createPaymentRequest,
    retrievePaymentRequest,
    createRefund,
    retrieveRefund
  };
}

module.exports = swishController;
