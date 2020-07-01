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
  getGoogleMapsUrl,
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
  getProductById
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
    const data = {
      delivery: moment()
        .tz('Europe/Stockholm')
        .week(week)
        .startOf('isoWeek')
        .add(2, 'days')
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
    return data;
  }

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
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'url')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'zone')
        && verify(recipient.delivery.zone, 'number')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'message');
  }

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

  async function parsePostData(postData) {
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
    for (const [key, q] of items) {
      const [, id] = key.split('-');
      const quantity = parseInt(q, 10);
      if (quantity > 0) {
        order.items.push({ id, quantity });
      }
    }

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
          url: getGoogleMapsUrl(postData.address),
          googleFormattedAddress: postData['google-formatted-address'],
          zone: parseInt(postData.zone, 10),
          message: ''
        }
      };
      order.recipients = [recipient];
    // } else if (order.delivery.type === 'split-delivery') {
    //   const numRecipients = parseInt(postData.recipients, 10);
    //   const recipients = [];
    //   let recipientId = 0;
    //   let i = 0;
    //   while (i < numRecipients) {
    //     if (`name-${recipientId}` in postData) {
    //       const recipient = {
    //         items: {
    //           comboBoxes: parseInt(postData[`recipient-num-comboboxes-${recipientId}`], 10),
    //           treatBoxes: parseInt(postData[`recipient-num-treatboxes-${recipientId}`], 10),
    //           vegetableBoxes: parseInt(postData[`recipient-num-vegetableboxes-${recipientId}`], 10)
    //         },
    //         details: {
    //           name: postData[`name-${recipientId}`],
    //           telephone: postData[`telephone-${recipientId}`]
    //         },
    //         delivery: {
    //           address: postData[`address-${recipientId}`],
    //           addressNotes: postData[`notes-address-${recipientId}`],
    //           url: getGoogleMapsUrl(postData[`address-${recipientId}`]),
    //           googleFormattedAddress: postData[`google-formatted-address-${recipientId}`],
    //           zone: parseInt(postData[`zone-${recipientId}`], 10),
    //           message: postData[`message-${recipientId}`]
    //         }
    //       };
    //       if (recipient.delivery.zone === 2) {
    //         cost.delivery += settings.delivery.zone2.price;
    //       }
    //       recipients.push(recipient);
    //       i += 1;
    //     }
    //     recipientId += 1;
    //   }
    //   order.recipients = recipients;
    }

    return order;
  }

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
      [`${week1.year}-${week1.week}`]: week1,
      // [`${week2.year}-${week2.week}`]: week2
    };

    const info = {
      status: 'OK',
      products,
      cost: {
        food: {
          comboBox: settings.food.comboBox.price,
          treatBox: settings.food.treatBox.price,
          vegetableBox: settings.food.vegetableBox.price
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
    statement.delivery = {
      zone2Price: treatboxSettings.delivery.zone2.price
    };
    statement.bottomLine.deliveryCost = treatboxSettings.delivery.zone2.price * delivery.zone2;
    statement.bottomLine.deliveryMoms = treatboxSettings.delivery.zone2.momsAmount * delivery.zone2;
    statement.bottomLine.totalMoms += statement.bottomLine.deliveryMoms;
    statement.bottomLine.total += statement.bottomLine.deliveryCost;

    return statement;
  }

  // Take properties from req.body and lookup price
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

  async function getPaymentResult(paymentId) {
    const apiConfig = {
      method: 'get',
      url: `${swish.baseUrl}/api/v1/paymentrequests/${paymentId}`,
      httpsAgent: swish.httpsAgent
    };

    let response;
    try {
      response = await axios(apiConfig);
    } catch {
      // hi
    }
    return response.data;
  }

  async function legacyOrderConfirmed(req, res) {
    const referer = req.headers.referer.split('?')[0];
    const { 'callback-url': callbackUrl } = req.body;

    const order = await parsePostData(req.body);
    order.payment = {
      method: req.body['payment-method'],
      status: 'Ordered'
    };

    if (order.delivery.type !== 'collection') {
      const highestOrder = await getHighestOrder();
      let nextOrder = 0;
      if (highestOrder !== undefined) {
        nextOrder = highestOrder.highestOrder + 1;
      }
      order.recipients.forEach((recipient) => {
        recipient.delivery.order = nextOrder;
        nextOrder += 1;
      });

      const smsSettings = await getSettings('sms');
      order.recipients.forEach((recipient) => {
        recipient.delivery.sms = parseMarkers(smsSettings.defaultDelivery, recipient);
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

      const uuid = uuidv4();
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
          amount: order.cost.total,
          currency: 'SEK',
          message: 'WHISK.se Order'
        }
      };

      try {
        const response = await axios(apiConfig);
        order.payment.swish.id = response.headers.location.split('/');
        order.payment.swish.id = order.payment.swish.id[order.payment.swish.id.length - 1];
      } catch (error) {
        debug(error);
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

  async function calculatePrice(order) {
    let zone2Deliveries = 0;
    if (order.delivery.type !== 'collection') {
      order.recipients.forEach((recipient) => {
        if (recipient.delivery.zone === 2) {
          zone2Deliveries += 1;
        }
      });
    }
    const statement = await lookupPrice(order.items, { zone2: zone2Deliveries });
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

    if (order.delivery.type !== 'collection') {
      const highestOrder = await getHighestOrder();
      let nextOrder = 0;
      if (highestOrder !== undefined) {
        nextOrder = highestOrder.highestOrder + 1;
      }
      order.recipients.forEach((recipient) => {
        recipient.delivery.order = nextOrder;
        nextOrder += 1;
      });

      const smsSettings = await getSettings('sms');
      order.recipients.forEach((recipient) => {
        recipient.delivery.sms = parseMarkers(smsSettings.defaultDelivery, recipient);
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

      const uuid = uuidv4();
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
          amount: order.statement.bottomLine.total,
          currency: 'SEK',
          message: 'WHISK.se Order'
        }
      };

      try {
        const response = await axios(apiConfig);
        order.payment.swish.id = response.headers.location.split('/');
        order.payment.swish.id = order.payment.swish.id[order.payment.swish.id.length - 1];
      } catch (error) {
        debug(error);
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
        currency: 'SEK'
      }
    };
    debug(apiConfig);

    try {
      const response = await axios(apiConfig);
      debug(response);
      debug('hi');
    } catch (error) {
      debug(error);
    }

    return res.json({ status: 'OK' });
  }

  return {
    parseSwishAlias,
    getWeekData,
    getDetails,
    apiLookupPrice,
    lookupRebateCode,
    orderStarted,
    legacyOrderConfirmed,
    orderConfirmed,
    swishRefund
  };
}

module.exports = treatBoxController;
