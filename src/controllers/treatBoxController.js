// Page Tag
const tag = 'whisk-management:treatBoxController';

// Requirements
const moment = require('moment-timezone');
const url = require('url');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const querystring = require('querystring');
const debug = require('debug')(tag);
const { verify } = require('../../lib/verify/verify')();
const { insertTreatBoxOrder, getSettings } = require('../../lib/db-control/db-control')(tag);

const callbackRoot = 'https://95b2ae6ba9bc.ngrok.io';

// Test Constants
const swishTest = {
  alias: '1234679304',
  baseUrl: 'https://mss.cpc.getswish.net/swish-cpcapi',
  callbackRoot,
  httpsAgent: new https.Agent({
    cert: fs.readFileSync('cert/test.pem'),
    key: fs.readFileSync('cert/test.key'),
    ca: fs.readFileSync('cert/test-ca.pem')
  })
};

// Production Constants
const swishProduction = {
  alias: '1230655860',
  baseUrl: 'https://cpc.getswish.net/swish-cpcapi',
  callbackRoot,
  httpsAgent: new https.Agent({
    cert: fs.readFileSync('cert/prod.pem'),
    key: fs.readFileSync('cert/prod.key')
  })
};

const swish = swishTest;

// Pricing
const foodMoms = 1.12;
const deliveryMoms = 1.25;

function treatBoxController() {
  // Format price from stored öre to krona
  function priceFormat(num) {
    const str = (num / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return parseInt(str.replace(',', ''), 10);
  }

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

  function getGoogleMapsUrl(address) {
    const q = querystring.stringify({
      api: 1,
      query: address
    });
    return `https://www.google.com/maps/search/?${q}`;
  }

  function parseSwishAlias(telephone) {
    let alias = telephone.replace(/\D/g,'');
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
    const settings = await getSettings('treatbox');

    let week;
    if (moment().isoWeekday() < 3) {
      week = moment().week();
    } else {
      week = moment().week() + 1;
    }
    const week1 = getWeekData(week);
    const week2 = getWeekData(week + 1);
    const timeframe = {
      [`${week1.year}-${week1.week}`]: week1,
      [`${week2.year}-${week2.week}`]: week2
    };

    const info = {
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
      invoiced: false,
      paid: false
    };

    debug(order);

    if (order.payment.method === 'Invoice') {
      insertTreatBoxOrder(order);
      // sendConfirmationEmail(order);

      const query = querystring.stringify({
        name: order.details.name
      });
      return res.redirect(`${callbackUrl}?${query}`);
    }

    if (order.payment.method === 'Swish') {
      order.payment.payerAlias = parseSwishAlias(order.details.telephone);
      const apiConfig = {
        method: 'post',
        url: `${swish.baseUrl}/api/v1/paymentrequests`,
        httpsAgent: swish.httpsAgent,
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          callbackUrl: `${swish.callbackRoot}/treatbox/swishcallback`,
          payeeAlias: swish.alias,
          payerAlias: order.payment.payerAlias,
          amount: order.cost.total,
          currency: 'SEK'
        }
      };

      try {
        const response = await axios(apiConfig);
        order.payment.id = response.headers.location.split('/');
        order.payment.id = order.payment.id[order.payment.id.length - 1];
      } catch (error) {
        let errors = '';
        if (error.response.data.length > 0) {
          errors = error.response.data.map(x => x.errorCode).join(',');
        }
        const query = querystring.stringify({
          status: errors
        });
        return res.redirect(307, `${referer}?${query}`);
      }

      (async function checkStatus() {
        setTimeout(() => {
          getPaymentResult(order.payment.id).then((response) => {
            if (response.status === 'PAID') {
              const query = querystring.stringify({
                name: order.details.name
              });

              order.payment.paid = true;
              insertTreatBoxOrder(order);

              return res.redirect(`${callbackUrl}?${query}`);
            }

            if (response.status === 'DECLINED' || response.status === 'ERROR') {
              const query = querystring.stringify({
                status: response.status
              });
              return res.redirect(307, `${referer}?${query}`);
            }

            checkStatus();
          });
        }, 1500);
      }());
    }
    //return res.redirect(307, referer);
  }

  return { parseSwishAlias, getWeekData, getDetails, orderStarted, orderConfirmed };
}

module.exports = treatBoxController;
