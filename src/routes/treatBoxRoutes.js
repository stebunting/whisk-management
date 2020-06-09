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
  removeTreatBoxOrder
} = require('../../lib/db-control/db-control')(tag);
const { sendConfirmationEmail } = require('../../lib/email/email')()

// Pricing
const comboBoxPrice = 49000;
const treatBoxPrice = 25000;
const vegetableBoxPrice = 25000;
const zone2DeliveryCost = 5000;

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
    }
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
    data.orderable= data.deadline.isAfter();
    data.vegetablesOrderable = data.vegetableDeadline.isAfter();
    data.week = data.delivery.week();
    data.year = data.delivery.year();
    return data;
  }

  // API to return important information
  treatBoxRoutes.route('/orderdetails')
    .get((req, res) => {
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

  // Data validation
  treatBoxRoutes.route('/confirmation')
    .post(async (req, res) => {
      debug(req.body);

      const info = {
        itemsOrdered: {
          comboBoxes: parseInt(req.body['num-comboboxes'] || 0, 10),
          treatBoxes: parseInt(req.body['num-treatboxes'] || 0, 10),
          vegetableBoxes: parseInt(req.body['num-vegetableboxes'] || 0, 10)
        },
        purchaser: {
          name: req.body.name || '',
          email: req.body.email || '',
          telephone: req.body.telephone || ''
        },
        delivery: {
          date: req.body.date,
          dateText: req.body['date-text'],
          type: req.body['delivery-type']
        },
        cost: {
          food: 0,
          delivery: 0,
          foodMoms: 0,
          deliveryMoms: 0,
          total: 0
        }
      };

      let i = 0;

      switch (info.delivery.type) {
        case 'collection':

          break;
        case 'delivery':
          info.delivery.address = req.body.address;
          info.delivery.addressNotes = req.body['notes-address'];
          info.delivery.googleFormattedAddress = req.body['google-formatted-address'];
          info.delivery.zone = parseInt(req.body.zone, 10);
          if (info.delivery.zone === 2) {
            info.cost.delivery += zone2DeliveryCost;
          }
          break;
        case 'split-delivery':
          info.recipients = [];
          while (`name-${i}` in req.body) {
            const recipient = {
              itemsToDeliver: req.body[`items-to-deliver-${i}`],
              numComboBoxes: parseInt(req.body[`recipient-num-comboboxes-${i}`], 10),
              numTreatBoxes: parseInt(req.body[`recipient-num-treatboxes-${i}`], 10),
              numVegetableBoxes: parseInt(req.body[`recipient-num-vegetableboxes-${i}`], 10),
              name: req.body[`name-${i}`],
              telephone: req.body[`telephone-${i}`],
              address: req.body[`address-${i}`],
              addressNotes: req.body[`notes-address-${i}`],
              zone: parseInt(req.body[`zone-${i}`], 10),
              message: req.body[`message-${i}`],
            };
            if (recipient.zone === 2) {
              info.cost.delivery += zone2DeliveryCost;
            }
            info.recipients.push(recipient);
            i += 1;
          }
          break;
        default:
          break;
      }

      info.cost.food = info.itemsOrdered.comboBoxes * comboBoxPrice
        + info.itemsOrdered.treatBoxes * treatBoxPrice
        + info.itemsOrdered.vegetableBoxes * vegetableBoxPrice;
      info.cost.foodMoms = priceFormat(info.cost.food - (info.cost.food / 1.12));
      info.cost.deliveryMoms = priceFormat(info.cost.delivery - (info.cost.delivery / 1.25));

      info.cost.total = priceFormat(info.cost.food + info.cost.delivery);
      info.cost.food = priceFormat(info.cost.food);
      info.cost.delivery = priceFormat(info.cost.delivery);

      debug(info);

      return res.json(info);
    });

  // Invoice payment route
  treatBoxRoutes.route('/invoicepayment')
    .post((req, res) => {
      const callbackUrl = req.body['callback-url'];

      const order = {
        itemsOrdered: {
          comboBoxes: parseInt(req.body['num-comboboxes'] || 0, 10),
          treatBoxes: parseInt(req.body['num-treatboxes'] || 0, 10),
          vegetableBoxes: parseInt(req.body['num-vegetableboxes'] || 0, 10)
        },
        purchaser: {
          name: req.body.name,
          email: req.body.email,
          telephone: req.body.telephone
        },
        delivery: {
          date: req.body.date,
          type: req.body['delivery-type']
        },
        cost: {
          food: parseInt(req.body['food-cost'], 10),
          delivery: parseInt(req.body['delivery-cost'], 10),
          foodMoms: parseInt(req.body['food-moms'], 10),
          deliveryMoms: parseInt(req.body['delivery-moms'], 10),
          total: parseInt(req.body['total-cost'], 10),
        },
        payment: {
          method: req.body['payment-method'],
          paid: false
        }
      };

      let i = 0;

      switch (order.delivery.type) {
        case 'collection':

          break;
        case 'delivery':
          order.delivery.address = req.body.address;
          order.delivery.addressNotes = req.body['notes-address'];
          order.delivery.googleFormattedAddress = req.body['google-formatted-address'];
          order.delivery.zone = parseInt(req.body.zone, 10);
          if (order.zone === 2) {
            order.cost.delivery += zone2DeliveryCost;
          }
          break;
        case 'split-delivery':
          order.recipients = [];
          while (`name-${i}` in req.body) {
            const recipient = {
              itemsToDeliver: req.body[`items-to-deliver-${i}`],
              numComboBoxes: parseInt(req.body[`recipient-num-comboboxes-${i}`], 10),
              numTreatBoxes: parseInt(req.body[`recipient-num-treatboxes-${i}`], 10),
              numVegetableBoxes: parseInt(req.body[`recipient-num-vegetableboxes-${i}`], 10),
              name: req.body[`name-${i}`],
              telephone: req.body[`telephone-${i}`],
              address: req.body[`address-${i}`],
              addressNotes: req.body[`notes-address-${i}`],
              zone: parseInt(req.body[`zone-${i}`], 10),
              message: req.body[`message-${i}`],
            };
            if (recipient.zone === 2) {
              order.cost.delivery += zone2DeliveryCost;
            }
            order.recipients.push(recipient);
            i += 1;
          }
          break;
        default:
          break;
      }

      insertTreatBoxOrder(order);
      sendConfirmationEmail(order);

      const query = querystring.stringify({
        name: order.purchaser.name
      })
      return res.redirect(`${callbackUrl}?${query}`);
    });

  treatBoxRoutes.route('/requestpayment')
    .get((req, res) => res.send('ok'));

  treatBoxRoutes.route('/orders')
    .get(async (req, res) => {
      const orders = await getTreatBoxOrders();
      for (let i = 0; i < orders.length; i += 1) {
        const q = querystring.stringify({
          api: 1,
          query: orders[i].delivery.address
        });
        orders[i].delivery.url = `https://www.google.com/maps/search/?${q}`;
      }
      res.render('treatboxOrders', { orders, getWeekData });
    });

  treatBoxRoutes.route('/orders/remove/:id')
    .get(async (req, res) => {
      const { id } = req.params;
      await removeTreatBoxOrder(id);
      return res.redirect('/treatbox/orders');
    });

  treatBoxRoutes.route('/orders/markaspaid/:id')
    .get(async (req, res) => {
      const { id } = req.params;
      await updateTreatBoxOrders(id, { 'payment.paid': true });
      return res.redirect('/treatbox/orders');
    });

  return treatBoxRoutes;
}


module.exports = routes;
