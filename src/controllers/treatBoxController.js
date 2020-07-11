// Page Tag
const tag = 'whisk-management:treatBoxController';

// Requirements
const moment = require('moment-timezone');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const debug = require('debug')(tag);
const {
  priceFormat,
  dateFormat,
  parseMarkers,
  getWeek
} = require('../functions/helper');
const { verify } = require('../../lib/verify/verify')();
const { sendConfirmationEmail } = require('../../lib/email/email')();
const {
  insertTreatBoxOrder,
  getTreatBoxOrderById,
  getHighestOrder,
  getSettings,
  getProducts,
  getProductById,
  recordSwishRefund,
  logError
} = require('../../lib/db-control/db-control')(tag);

const callbackRoot = 'https://whisk-management.herokuapp.com';

// Test Constants
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

// Production Constants
const swishProduction = {
  alias: process.env.SWISH_ALIAS,
  baseUrl: 'https://cpc.getswish.net/swish-cpcapi',
  callbackRoot,
  httpsAgent: new https.Agent({
    cert: Buffer.from(JSON.parse(`"${process.env.SWISH_CERT}"`)),
    key: Buffer.from(JSON.parse(`"${process.env.SWISH_KEY}"`))
  })
};

const swish = swishTest;

function treatBoxController() {
  // Function to get all relevant dates from a week number
  function getWeekData(week) {
    // Set Delivery day to Wednesday
    const deliveryDay = 3;

    const data = {
      delivery: moment()
        .tz('Europe/Stockholm')
        .week(week)
        .startOf('isoWeek')
        .add(deliveryDay - 1, 'days')
    };
    data.deadline = data.delivery.clone()
      .subtract(1, 'day')
      .hours(11)
      .minutes(0)
      .seconds(0)
      .milliseconds(0);
    data.vegetableDeadline = moment(data.delivery)
      .subtract(4, 'days')
      .hours(9)
      .minutes(0)
      .seconds(0)
      .milliseconds(0);
    data.orderable = data.deadline.isAfter();
    data.vegetablesOrderable = data.vegetableDeadline.isAfter();
    data.week = data.delivery.week();
    data.year = data.delivery.year();
    data.day = data.delivery.day();
    return data;
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

  function validateDetails(details) {
    return Object.prototype.hasOwnProperty.call(details, 'name')
        && verify(details.name, 'name')
        && Object.prototype.hasOwnProperty.call(details, 'telephone')
        && verify(details.telephone, 'telephone');
  }

  function validateRecipient(recipient) {
    return Object.prototype.hasOwnProperty.call(recipient, 'items')
        && Object.prototype.hasOwnProperty.call(recipient, 'details')
        && validateDetails(recipient.details)
        && Object.prototype.hasOwnProperty.call(recipient, 'delivery')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'address')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'googleFormattedAddress')
        && verify(recipient.delivery.address, 'string')
        && recipient.delivery.address === recipient.delivery.googleFormattedAddress
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'addressNotes')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'zone')
        && verify(recipient.delivery.zone, 'number')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'message');
  }

  // Function to validate order
  function validateOrder(order) {
    let valid = Object.prototype.hasOwnProperty.call(order, 'items')
             && Object.prototype.hasOwnProperty.call(order, 'details')
             && validateDetails(order.details)
             && Object.prototype.hasOwnProperty.call(order.details, 'email')
             && verify(order.details.email, 'email')
             && Object.prototype.hasOwnProperty.call(order, 'delivery')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'date')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'type');

    switch (order.delivery.type) {
      case 'collection':
        return valid;

      case 'delivery':
        return valid
            && Object.prototype.hasOwnProperty.call(order, 'recipients')
            && order.recipients.length === 1
            && validateRecipient(order.recipients[0]);

      case 'split-delivery':
        valid = valid
             && Object.prototype.hasOwnProperty.call(order, 'recipients')
             && order.recipients.length >= 1;

        order.recipients.forEach((recipient) => {
          valid = valid && validateRecipient(recipient);
        });

        return valid;

      default:
        return false;
    }
  }

  // Function to convert posted data to an order object
  async function parsePostData(postData) {
    // Get list of products
    const rawProducts = await getProducts();
    const products = {};
    for (let i = 0; i < rawProducts.length; i += 1) {
      /* eslint-disable-next-line no-underscore-dangle */
      products[rawProducts[i]._id] = rawProducts[i].name;
    }

    const order = {
      items: [],
      details: {
        name: postData.name,
        email: postData.email,
        telephone: postData.telephone
      },
      delivery: {
        date: postData.date,
        type: postData['delivery-type']
      }
    };

    const items = Object.entries(postData).filter((x) => x[0].startsWith('quantity-'));
    items.forEach((item) => {
      const [, id] = item[0].split('-');
      const quantity = parseInt(item[1], 10);
      const name = products[id];
      if (quantity > 0) {
        order.items.push({ id, quantity, name });
      }
    });

    if (order.delivery.type === 'delivery') {
      const recipient = {
        items: order.items,
        details: {
          name: order.details.name,
          telephone: order.details.telephone
        },
        delivery: {
          address: postData.address,
          addressNotes: postData['notes-address'],
          googleFormattedAddress: postData['google-formatted-address'],
          zone: parseInt(postData.zone, 10),
          message: ''
        }
      };
      order.recipients = [recipient];
    } else if (order.delivery.type === 'split-delivery') {
      const recipients = JSON.parse(postData.recipients);
      const allItems = JSON.parse(postData.items);
      order.recipients = [];

      recipients.forEach((recipient) => {
        let recipientsItems = allItems.filter((x) => x.recipient === recipient);
        const counts = {};
        recipientsItems.forEach((item) => {
          counts[item.id] = {
            quantity: (counts[item.id.quantity] || 0) + 1,
            name: item.name
          };
        });
        recipientsItems = [];
        Object.entries(counts).forEach((item) => {
          recipientsItems.push({
            id: item[0],
            quantity: item[1].quantity,
            name: item[1].name
          });
        });
        const newRecipient = {
          items: recipientsItems,
          details: {
            name: postData[`name-${recipient}`],
            telephone: postData[`telephone-${recipient}`]
          },
          delivery: {
            address: postData[`address-${recipient}`],
            addressNotes: postData[`notes-address-${recipient}`],
            googleFormattedAddress: postData[`google-formatted-address-${recipient}`],
            zone: parseInt(postData[`zone-${recipient}`], 10),
            message: postData[`message-${recipient}`]
          }
        };
        order.recipients.push(newRecipient);
      });
    }

    return order;
  }

  // Return products and timeframes to browser
  async function getDetails(req, res) {
    const promises = [
      getSettings('treatbox'),
      getProducts()
    ];
    const data = await Promise.allSettled(promises);
    if (data[0].status !== 'fulfilled' || data[1].status !== 'fulfilled') {
      return res.json({ status: 'Error' });
    }
    const settings = data[0].value;
    const products = data[1].value;

    const week = getWeek();
    const week1 = getWeekData(week);
    // const week2 = getWeekData(week + 1);
    const timeframe = {
      [`${week1.year}-${week1.week}-${week1.day}`]: week1,
      // [`${week2.year}-${week2.week}-${week2.day}`]: week2
    };

    const info = {
      status: 'OK',
      products,
      cost: {
        food: {
          comboBox: 490,
          treatBox: 250,
          vegetableBox: 250
        },
        delivery: {
          local: 0,
          zone1: 0,
          zone2: settings.delivery.zone2.price
        }
      },
      momsRate: {
        food: 12,
        delivery: 25
      },
      timeframe
    };

    return res.json(info);
  }

  // Function to generate a statement of costs from products and delivery
  async function lookupPrice(basket, delivery) {
    const statement = {
      products: [],
      bottomLine: {
        foodCost: 0,
        deliveryCost: 0,
        foodMoms: 0,
        deliveryMoms: 0,
        totalMoms: 0,
        total: 0
      }
    };

    // Get Food Cost
    const promises = [];
    for (let i = 0; i < basket.length; i += 1) {
      promises.push(getProductById(basket[i].id));
    }
    const data = await Promise.allSettled(promises);
    for (let i = 0; i < data.length; i += 1) {
      // eslint-disable-next-line no-underscore-dangle
      if (data[i].status === 'fulfilled' && data[i].value._id.equals(basket[i].id)) {
        const product = data[i].value;
        const newProduct = {
          // eslint-disable-next-line no-underscore-dangle
          id: product._id,
          name: product.name,
          quantity: parseInt(basket[i].quantity, 10),
          price: parseInt(product.grossPrice, 10),
          momsAmount: parseInt(product.momsAmount, 10),
          momsRate: product.momsRate,
          subTotal: parseInt(basket[i].quantity, 10) * parseInt(product.grossPrice, 10),
          momsSubTotal: parseInt(basket[i].quantity, 10) * parseInt(product.momsAmount, 10)
        };
        statement.bottomLine.foodCost += newProduct.subTotal;
        statement.bottomLine.foodMoms += newProduct.momsSubTotal;
        statement.bottomLine.totalMoms += newProduct.momsSubTotal;
        statement.bottomLine.total += newProduct.subTotal;
        statement.products.push(newProduct);
      } else {
        throw new Error('Promise unfulfilled');
      }
    }

    // Get Delivery Cost
    const treatboxSettings = await getSettings('treatbox');
    statement.delivery = {};
    if (delivery.zone2 > 0) {
      statement.delivery.zone2 = {
        price: treatboxSettings.delivery.zone2.price,
        quantity: delivery.zone2,
        momsAmount: treatboxSettings.delivery.zone2.momsAmount,
        momsRate: treatboxSettings.delivery.zone2.momsRate,
        momsSubTotal: treatboxSettings.delivery.zone2.momsAmount * delivery.zone2,
        subTotal: treatboxSettings.delivery.zone2.price * delivery.zone2
      };
      statement.bottomLine.deliveryCost += statement.delivery.zone2.subTotal;
      statement.bottomLine.deliveryMoms += statement.delivery.zone2.momsSubTotal;
    }
    if (delivery.zone3 > 0) {
      statement.delivery.zone3 = {
        price: treatboxSettings.delivery.zone2.price,
        quantity: delivery.zone3,
        momsAmount: treatboxSettings.delivery.zone2.momsAmount,
        momsRate: treatboxSettings.delivery.zone2.momsRate,
        momsSubTotal: treatboxSettings.delivery.zone2.momsAmount * delivery.zone3,
        subTotal: treatboxSettings.delivery.zone2.price * delivery.zone3
      };
      statement.bottomLine.deliveryCost += statement.delivery.zone3.subTotal;
      statement.bottomLine.deliveryMoms += statement.delivery.zone3.momsSubTotal;
    }
    statement.bottomLine.totalMoms += statement.bottomLine.deliveryMoms;
    statement.bottomLine.total += statement.bottomLine.deliveryCost;

    return statement;
  }

  // Take properties from req.body and call lookupPrice
  async function apiLookupPrice(req, res) {
    const basket = JSON.parse(req.body.basket);
    const delivery = JSON.parse(req.body.delivery);

    try {
      const statement = await lookupPrice(basket, delivery);
      statement.status = 'OK';
      return res.json(statement);
    } catch (error) {
      return res.json({ status: 'Error' });
    }
  }

  // Function to look up a rebate code
  async function lookupRebateCode(req, res) {
    const { code } = req.query;

    const response = await getSettings('rebatecodes');
    const result = response.codes.filter((x) => x.value.toLowerCase() === code.toLowerCase());
    if (result.length === 0) {
      return res.json({ valid: false });
    }
    return res.json({
      valid: true,
      code: result[0]
    });
  }

  // Function to validate order server-side
  // If valid, redirects to confirmation page, else returns to order form
  async function orderStarted(req, res) {
    const { referer } = req.headers;
    const { 'callback-url': callbackUrl } = req.body;

    const order = await parsePostData(req.body);
    const valid = validateOrder(order);

    if (valid) {
      return res.redirect(307, callbackUrl);
    }
    return res.redirect(307, referer);
  }

  // Function to call Swish to check payment status
  async function getPaymentResult(paymentId) {
    const apiConfig = {
      method: 'get',
      url: `${swish.baseUrl}/api/v1/paymentrequests/${paymentId}`,
      httpsAgent: swish.httpsAgent
    };

    let response;
    try {
      response = await axios(apiConfig);
      return response.data;
    } catch (error) {
      logError('Error while calling Swish API to call get payment result', error);
      return { status: 'GET_RESULT_ERROR' };
    }
  }

  // Function to call Swish to check payment status
  async function getRefundResult(refundId) {
    const apiConfig = {
      method: 'get',
      url: `${swish.baseUrl}/api/v1/refunds/${refundId}`,
      httpsAgent: swish.httpsAgent,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    let response;
    try {
      response = await axios(apiConfig);  
      return response.data;
    } catch (error) {
      logError('Error while calling Swish API to call get refund result', error);
      return { status: 'GET_RESULT_ERROR' };
    }
  }

  // Function to calculate order price
  async function calculatePrice(order) {
    let zone2Deliveries = 0;
    let zone3Deliveries = 0;
    if (order.delivery.type !== 'collection') {
      order.recipients.forEach((recipient) => {
        if (recipient.delivery.zone === 2) {
          zone2Deliveries += 1;
        } else if (recipient.delivery.zone === 3) {
          zone3Deliveries += 1;
        }
      });
    }
    const statement = await lookupPrice(order.items, {
      zone2: zone2Deliveries,
      zone3: zone3Deliveries
    });
    return statement;
  }

  async function orderConfirmed(req, res) {
    const referer = req.headers.referer.split('?')[0];
    const { 'callback-url': callbackUrl } = req.body;

    const order = await parsePostData(req.body);
    const statement = await calculatePrice(order);
    order.statement = statement;
    delete order.items;

    order.payment = {
      method: req.body['payment-method'],
      status: 'Ordered'
    };
    if (req.body['rebate-codes'] != null) {
      order.rebateCodes = req.body['rebate-codes'].split(',')
    }

    if (order.delivery.type !== 'collection') {
      let nextOrder = 0;
      let smsSettings;
      const promises = [
        getHighestOrder(),
        getSettings('sms')
      ];
      await Promise.allSettled(promises).then((data) => {
        if (data[0].status === 'fulfilled') {
          if (data[0].value) {
            nextOrder = data[0].value.highestOrder + 1;
          }
        }
        if (data[1].status === 'fulfilled') {
          smsSettings = data[1].value;
        }
      });

      order.recipients.forEach((recipient, index) => {
        order.recipients[index].delivery.sms = parseMarkers(smsSettings.defaultDelivery, recipient);
        order.recipients[index].delivery.order = nextOrder;
        nextOrder += 1;
      });
    }

    if (order.payment.method === 'Invoice') {
      insertTreatBoxOrder(order);
      sendConfirmationEmail(order);

      const query = querystring.stringify({
        name: order.details.name
      });
      return res.redirect(`${callbackUrl}?${query}`);
    }

    if (order.payment.method === 'Swish') {
      order.payment.swish = {
        payerAlias: parseSwishAlias(order.details.telephone)
      };

      // const uuid = uuidv4();
      const apiConfig = {
        method: 'post',
        url: `${swish.baseUrl}/api/v1/paymentrequests`, // ${uuid}`,
        httpsAgent: swish.httpsAgent,
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          callbackUrl: `${swish.callbackRoot}/treatbox/swishcallback`,
          payeeAlias: swish.alias,
          payerAlias: order.payment.swish.payerAlias,
          amount: priceFormat(order.statement.bottomLine.total, { includeSymbol: false }),
          currency: 'SEK',
          message: 'WHISK.se Order'
        }
      };

      try {
        const response = await axios(apiConfig);
        order.payment.swish.id = response.headers.location.split('/');
        order.payment.swish.id = order.payment.swish.id[order.payment.swish.id.length - 1];
        order.payment.swish.refunds = [];
      } catch (error) {
        logError(`Error sending Swift payment request (${order.details.name} - ${order.details.telephone})`, error);
        let errors = '';
        if (error.response && error.response.data.length > 0) {
          errors = error.response.data.map((x) => x.errorCode).join(',');
        } else {
          errors = 'ERROR';
        }
        const query = querystring.stringify({
          status: errors
        });
        return res.redirect(307, `${referer}?${query}`);
      }

      (async function checkStatus() {
        setTimeout(() => {
          getPaymentResult(order.payment.swish.id).then((response) => {
            // if (response.id !== uuid) {
            //   const query = querystring.stringify({
            //     status: 'INVALID_UUID'
            //   });
            //   return res.redirect(307, `${referer}?${query}`);
            // }

            order.payment.swish.reference = response.paymentReference;
            if (response.status === 'PAID') {
              const query = querystring.stringify({
                name: order.details.name
              });

              order.payment.status = 'Paid';
              insertTreatBoxOrder(order);
              sendConfirmationEmail(order);

              return res.redirect(`${callbackUrl}?${query}`);
            }

            if (response.status === 'DECLINED' || response.status === 'ERROR') {
              const query = querystring.stringify({
                status: response.status
              });
              return res.redirect(307, `${referer}?${query}`);
            }

            checkStatus();
            return true;
          });
        }, 1500);
      }());
    } else {
      return res.redirect(307, referer);
    }
  }

  async function swishRefund(req, res) {
    const { id, amount } = req.body;

    const order = await getTreatBoxOrderById(id);
    const apiConfig = {
      method: 'post',
      url: `${swish.baseUrl}/api/v1/refunds`,
      httpsAgent: swish.httpsAgent,
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        originalPaymentReference: order.payment.swish.reference,
        callbackUrl: `${swish.callbackRoot}/treatbox/swishcallback`,
        payerAlias: swish.alias,
        amount,
        currency: 'SEK',
        message: ''
      }
    };

    let refundId;
    try {
      const response = await axios(apiConfig);
      const location = response.headers.location.split('/');
      refundId = location[location.length - 1];
    } catch (error) {
      return res.json({
        status: 'Error',
        error: error.response.data.errors
      })
    }

    (async function checkStatus() {
      setTimeout(() => {
        getRefundResult(refundId).then((response) => {
          if (response.status === 'PAID') {
            const timestamp = new Date();
            const intAmount = parseInt(amount, 10) * 100
            recordSwishRefund(id, {
              timestamp,
              id: refundId,
              amount: intAmount,
            });

            return res.json({
              status: 'Paid',
              timestamp: dateFormat(timestamp, { format: 'short' }),
              amount: priceFormat(intAmount)
            });
          } else if (response.status === 'ERROR') {
            return res.json({
              status: 'Error'
            })
          }

          checkStatus();
          return true;
        });
      }, 1500);
    }());
  }

  return {
    parseSwishAlias,
    getWeekData,
    getDetails,
    apiLookupPrice,
    lookupRebateCode,
    orderStarted,
    orderConfirmed,
    swishRefund
  };
}

module.exports = treatBoxController;
