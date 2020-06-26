// Page Tag
const tag = 'whisk-management:treatBoxController';

// Requirements
const moment = require('moment-timezone');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ObjectID } = require('mongodb');
const querystring = require('querystring');
const debug = require('debug')(tag);
const {
  priceFormat,
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
  callbackRoot: 'https://536405b74ff7.ngrok.io',
  httpsAgent: new https.Agent({
    cert: fs.readFileSync('cert/Swish_Merchant_TestSigningCertificate_1234679304.pem'),
    key: fs.readFileSync('cert/Swish_Merchant_TestSigningCertificate_1234679304.key'),
    ca: fs.readFileSync('cert/Swish_TLS_RootCA.pem')
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

// Pricing
const foodMoms = 1.12;
const deliveryMoms = 1.25;

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

  function validateItems(items) {
    return Object.prototype.hasOwnProperty.call(items, 'comboBoxes')
        && verify(items.comboBoxes, 'number')
        && Object.prototype.hasOwnProperty.call(items, 'treatBoxes')
        && verify(items.treatBoxes, 'number')
        && Object.prototype.hasOwnProperty.call(items, 'vegetableBoxes')
        && verify(items.vegetableBoxes, 'number');
  }

  function validateDetails(details) {
    return Object.prototype.hasOwnProperty.call(details, 'name')
        && verify(details.name, 'name')
        && Object.prototype.hasOwnProperty.call(details, 'telephone')
        && verify(details.telephone, 'telephone');
  }

  function validateRecipient(recipient) {
    return Object.prototype.hasOwnProperty.call(recipient, 'items')
        && validateItems(recipient.items)
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
             && validateItems(order.items)
             && Object.prototype.hasOwnProperty.call(order, 'details')
             && validateDetails(order.details)
             && Object.prototype.hasOwnProperty.call(order.details, 'email')
             && verify(order.details.email, 'email')
             && Object.prototype.hasOwnProperty.call(order, 'delivery')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'date')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'type')
             && Object.prototype.hasOwnProperty.call(order, 'cost')
             && Object.prototype.hasOwnProperty.call(order.cost, 'food')
             && Object.prototype.hasOwnProperty.call(order.cost, 'delivery')
             && Object.prototype.hasOwnProperty.call(order.cost, 'foodMoms')
             && Object.prototype.hasOwnProperty.call(order.cost, 'deliveryMoms')
             && Object.prototype.hasOwnProperty.call(order.cost, 'total');

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
    const settings = await getSettings('treatbox');

    const order = {
      items: {
        comboBoxes: parseInt(postData['num-comboboxes'], 10) || 0,
        treatBoxes: parseInt(postData['num-treatboxes'], 10) || 0,
        vegetableBoxes: parseInt(postData['num-vegetableboxes'], 10) || 0
      },
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
    const cost = {
      delivery: 0
    };

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
      if (recipient.delivery.zone === 2) {
        cost.delivery += settings.delivery.zone2.price;
      }
    } else if (order.delivery.type === 'split-delivery') {
      const numRecipients = parseInt(postData.recipients, 10);
      const recipients = [];
      let recipientId = 0;
      let i = 0;
      while (i < numRecipients) {
        if (`name-${recipientId}` in postData) {
          const recipient = {
            items: {
              comboBoxes: parseInt(postData[`recipient-num-comboboxes-${recipientId}`], 10),
              treatBoxes: parseInt(postData[`recipient-num-treatboxes-${recipientId}`], 10),
              vegetableBoxes: parseInt(postData[`recipient-num-vegetableboxes-${recipientId}`], 10)
            },
            details: {
              name: postData[`name-${recipientId}`],
              telephone: postData[`telephone-${recipientId}`]
            },
            delivery: {
              address: postData[`address-${recipientId}`],
              addressNotes: postData[`notes-address-${recipientId}`],
              url: getGoogleMapsUrl(postData[`address-${recipientId}`]),
              googleFormattedAddress: postData[`google-formatted-address-${recipientId}`],
              zone: parseInt(postData[`zone-${recipientId}`], 10),
              message: postData[`message-${recipientId}`]
            }
          };
          if (recipient.delivery.zone === 2) {
            cost.delivery += settings.delivery.zone2.price;
          }
          recipients.push(recipient);
          i += 1;
        }
        recipientId += 1;
      }
      order.recipients = recipients;
    }

    cost.food = order.items.comboBoxes * settings.food.comboBox.price
      + order.items.treatBoxes * settings.food.treatBox.price
      + order.items.vegetableBoxes * settings.food.vegetableBox.price;
    cost.foodMoms = priceFormat(cost.food - (cost.food / foodMoms));
    cost.deliveryMoms = priceFormat(cost.delivery - (cost.delivery / deliveryMoms));
    cost.total = priceFormat(cost.food + cost.delivery);
    cost.food = priceFormat(cost.food);
    cost.delivery = priceFormat(cost.delivery);
    order.cost = cost;

    return order;
  }

  async function getDetails(req, res) {
    const promises = [
      getSettings('treatbox'),
      getProducts()
    ]
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

  async function lookupPrice(req, res) {
    const basket = JSON.parse(req.body.basket);
    const statement = {
      status: 'OK',
      bottomLine : {
        foodCost: 0,
        deliveryCost: 0,
        foodMoms: 0,
        deliveryMoms: 0,
        totalMoms: 0,
        total: 0
      }
    };
    const promises = []
    for (let i = 0; i < basket.length; i += 1) {
      promises.push(getProductById(basket[i].id));
    }
    const data = await Promise.allSettled(promises)
    for (let i = 0; i < data.length; i += 1) {
      if (data[i].status === 'fulfilled' && data[i].value._id.equals(basket[i].id)) {
        product = data[i].value;
        statement[product._id] = {
          name: product.name,
          quantity: parseInt(basket[i].quantity, 10),
          price: parseInt(product.grossPrice, 10),
          momsSubTotal: parseInt(basket[i].quantity, 10) * parseInt(product.momsAmount, 10),
          subTotal: parseInt(basket[i].quantity, 10) * parseInt(product.grossPrice, 10)
        }
        statement.bottomLine.foodCost += statement[product._id].subTotal;
        statement.bottomLine.foodMoms += statement[product._id].momsSubTotal;
        statement.bottomLine.totalMoms += statement[product._id].momsSubTotal;
        statement.bottomLine.total += statement[product._id].subTotal;
      } else {
        return res.json({ status: 'Error '});
      }
    }

    return res.json(statement);
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

  async function orderConfirmed(req, res) {
    const referer = req.headers.referer.split('?')[0];
    const { 'callback-url': callbackUrl } = req.body;

    const order = await parsePostData(req.body);
    order.payment = {
      method: req.body['payment-method'],
      status: 'Ordered'
    };

    if(order.delivery.type !== 'collection') {
      const highestOrder = await getHighestOrder();
      let nextOrder = 0
      if (highestOrder !== undefined) {
        nextOrder = highestOrder.highestOrder + 1;
      }
      order.recipients.forEach((recipient) => {
        recipient.delivery.order = nextOrder;
        nextOrder += 1;
      })

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
        url: `${swish.baseUrl}/api/v1/paymentrequests`, //${uuid}`,
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
    lookupPrice,
    lookupRebateCode,
    orderStarted,
    orderConfirmed,
    swishRefund
  };
}

module.exports = treatBoxController;
