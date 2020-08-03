// Page Tag
const tag = 'whisk-management:swish';

// Requirements
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const debug = require('debug')(tag);
const { logError } = require('../db-control/db-control')();
const { priceFormat } = require('../../src/functions/helper');

// Test Constants
// eslint-disable-next-line no-unused-vars
const swishTest = {
  alias: '1234679304',
  baseUrl: 'https://mss.cpc.getswish.net/swish-cpcapi',
  callbackRoot: 'https://5463a9270d6b.ngrok.io',
  httpsAgent: new https.Agent({
    cert: fs.readFileSync('cert/test.pem'),
    key: fs.readFileSync('cert/test.key'),
    ca: fs.readFileSync('cert/test-ca.pem'),
    passphrase: 'swish'
  })
};

// Production Constants
// eslint-disable-next-line no-unused-vars
const swishProduction = {
  alias: process.env.SWISH_ALIAS,
  baseUrl: 'https://cpc.getswish.net/swish-cpcapi',
  callbackRoot: 'https://whisk-management.herokuapp.com',
  httpsAgent: new https.Agent({
    cert: Buffer.from(JSON.parse(`"${process.env.SWISH_CERT}"`)),
    key: Buffer.from(JSON.parse(`"${process.env.SWISH_KEY}"`))
  })
};

const swish = swishTest;

function swishController() {
  // Function to return a UUID suitable for Swish (32 characters, no dashes, capitals)
  function getSwishUUID() {
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
    const id = getSwishUUID();
    const apiConfig = {
      method: 'put',
      url: `${swish.baseUrl}/api/v2/paymentrequests/${id}`,
      httpsAgent: swish.httpsAgent,
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        callbackUrl: `${swish.callbackRoot}/treatbox/swishcallback`,
        payeeAlias: swish.alias,
        payerAlias: parseSwishAlias(payerTelephone),
        amount: parseInt(priceFormat(amount, { includeSymbol: false }), 10),
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
      logError(`Error sending Swift payment request (${id})`, error);
      let errors = '';
      if (error.response && error.response.data.length > 0) {
        errors = error.response.data.map((x) => x.errorCode);
      } else {
        errors = ['ERROR'];
      }
      return {
        status: 'Error',
        errors
      };
    }
  }

  return {
    createPaymentRequest
  };
}

module.exports = swishController;
