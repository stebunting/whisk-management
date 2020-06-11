// Page Tag
const tag = 'whisk-management:treatBoxRoutes';

// Requirements
const express = require('express');
const querystring = require('querystring');
const moment = require('moment-timezone');
const debug = require('debug')(tag);
const {
  insertTreatBoxOrder,
  getTreatBoxOrders,
  updateTreatBoxOrders,
  getTreatBoxTotals
} = require('../../lib/db-control/db-control')(tag);
const { sendConfirmationEmail } = require('../../lib/email/email')();
const { loginCheck } = require('../controllers/authController')();

// Pricing
const comboBoxPrice = 49000;
const treatBoxPrice = 25000;
const vegetableBoxPrice = 25000;
const zone2DeliveryCost = 5000;
const foodMoms = 1.12;
const deliveryMoms = 1.25;

function routes() {
  const treatBoxRoutes = express.Router();

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

  function getReadableOrder(order) {
    let str = '';
    if (order.comboBoxes > 0) {
      str = `${str}${order.comboBoxes} x Combo Box${order.comboBoxes !== 1 ? 'es' : ''}`;
    }
    if (order.treatBoxes > 0) {
      str = `${str}${str.length > 0 ? ', ' : ''}${order.treatBoxes} x Treat Box${order.treatBoxes !== 1 ? 'es' : ''}`;
    }
    if (order.vegetableBoxes > 0) {
      str = `${str}${str.length > 0 ? ', ' : ''}${order.vegetableBoxes} x Vegetable Box${order.vegetableBoxes !== 1 ? 'es' : ''}`;
    }
    return str;
  }

  function getGoogleMapsUrl(address) {
    const q = querystring.stringify({
      api: 1,
      query: address
    });
    return `https://www.google.com/maps/search/?${q}`;
  }

  function parsePostData(postData) {
    const order = {
      items: {
        comboBoxes: parseInt(postData['num-comboboxes'], 10),
        treatBoxes: parseInt(postData['num-treatboxes'], 10),
        vegetableBoxes: parseInt(postData['num-vegetableboxes'], 10)
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
        cost.delivery += zone2DeliveryCost;
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
              zone: parseInt(postData[`zone-${recipientId}`], 10),
              message: postData[`message-${recipientId}`]
            }
          };
          if (recipient.delivery.zone === 2) {
            cost.delivery += zone2DeliveryCost;
          }
          recipients.push(recipient);
          i += 1;
        }
        recipientId += 1;
      }
      order.recipients = recipients;
    }

    cost.food = order.items.comboBoxes * comboBoxPrice
      + order.items.treatBoxes * treatBoxPrice
      + order.items.vegetableBoxes * vegetableBoxPrice;
    cost.foodMoms = priceFormat(cost.food - (cost.food / foodMoms));
    cost.deliveryMoms = priceFormat(cost.delivery - (cost.delivery / deliveryMoms));
    cost.total = priceFormat(cost.food + cost.delivery);
    cost.food = priceFormat(cost.food);
    cost.delivery = priceFormat(cost.delivery);
    order.cost = cost;

    return order;
  }

  // API to return important information
  treatBoxRoutes.route('/orderdetails')
    .get((req, res) => {
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
            comboBox: comboBoxPrice,
            treatBox: treatBoxPrice,
            vegetableBox: vegetableBoxPrice
          },
          delivery: {
            local: 0,
            zone1: 0,
            zone2: zone2DeliveryCost
          }
        },
        momsRate: {
          food: 12,
          delivery: 25
        },
        timeframe
      };

      return res.json(info);
    });

  // Data Validation
  treatBoxRoutes.route('/confirmation')
    .post(async (req, res) => {
      const { referer } = req.headers;
      const { 'callback-url': callbackUrl } = req.body;

      const valid = true;
      const order = parsePostData(req.body);

      debug(order);
      if (valid) {
        return res.redirect(307, callbackUrl);
      }
      return res.redirect(307, referer);
    });

  // Invoice payment route
  treatBoxRoutes.route('/invoicepayment')
    .post((req, res) => {
      const { 'callback-url': callbackUrl } = req.body;

      const order = parsePostData(req.body);
      order.payment = {
        method: req.body['payment-method'],
        paid: false
      };

      debug(order);

      insertTreatBoxOrder(order);
      // sendConfirmationEmail(order);

      const query = querystring.stringify({
        name: order.details.name
      });
      return res.redirect(`${callbackUrl}?${query}`);
    });

  treatBoxRoutes.route('/requestpayment')
    .get((req, res) => res.send('ok'));

  treatBoxRoutes.route('/orders')
    .all(loginCheck)
    .get(async (req, res) => {
      const orders = await getTreatBoxOrders();
      const totals = await getTreatBoxTotals();

      res.render('treatboxOrders', {
        orders,
        totals,
        getWeekData,
        getReadableOrder
      });
    });

  treatBoxRoutes.route('/orders/markaspaid/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      await updateTreatBoxOrders(id, { 'payment.paid': true });
      return res.redirect('/treatbox/orders');
    });

  return treatBoxRoutes;
}


module.exports = routes;
