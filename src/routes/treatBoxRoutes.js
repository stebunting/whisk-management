// Page Tag
const tag = 'whisk-management:treatBoxRoutes';
const stringify = require('csv-stringify');

// Requirements
const express = require('express');
const querystring = require('querystring');
const moment = require('moment-timezone');
const debug = require('debug')(tag);
const { dateFormat } = require('../functions/helper');
const {
  getTreatBoxOrders,
  getTreatBoxOrderById,
  getRecipients,
  updateTreatBoxOrders,
  getTreatBoxTotals,
  getTreatBoxDates
} = require('../../lib/db-control/db-control')(tag);
const {
  priceFormat,
  getReadableOrder,
  getWeek,
  parseDateCode,
  getGoogleMapsUrl
} = require('../functions/helper');
const { loginCheck } = require('../controllers/authController')();
const {
  getDetails,
  apiLookupPrice,
  lookupRebateCode,
  orderStarted,
  orderConfirmed,
  swishRefund
} = require('../controllers/treatBoxController')();

function routes() {
  const treatBoxRoutes = express.Router();

  // API to return important information
  treatBoxRoutes.route('/orderdetails')
    .get(getDetails);

  treatBoxRoutes.route('/lookupprice')
    .post(apiLookupPrice);

  treatBoxRoutes.route('/lookuprebate')
    .get(lookupRebateCode);

  // Data Validation
  treatBoxRoutes.route('/confirmation')
    .post(orderStarted);

  // Invoice payment route
  // treatBoxRoutes.route('/invoicepayment')
  //   .post(legacyOrderConfirmed);

  // Invoice payment route
  treatBoxRoutes.route('/payment')
    .post(orderConfirmed);

  treatBoxRoutes.route('/swishcallback')
    .post((req, res) => res.send('ok'));

  treatBoxRoutes.route('/orders')
    .all(loginCheck)
    .get(async (req, res) => {
      const { date } = req.query;
      let query;
      if (date === undefined) {
        query = {};
      } else if (date === 'thisweek') {
        const week = getWeek();
        const year = moment().week(week).year();
        const dateCode = `${year}-${week}`;
        query = { 'delivery.date': { $regex: `^${dateCode}` } };
      } else if (date === 'nextweek') {
        const week = getWeek(1);
        const year = moment().week(week).year();
        const dateCode = `${year}-${week}`;
        query = { 'delivery.date': { $regex: `^${dateCode}` } };
      } else {
        query = { 'delivery.date': date };
      }

      const promises = [
        getRecipients(query),
        getTreatBoxTotals(query),
        getTreatBoxDates()
      ];
      let orders;
      let totals;
      let treatboxDates;
      const data = await Promise.allSettled(promises);
      if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
        orders = data[0].value;
        totals = data[1].value;
        treatboxDates = data[2].value;
      }

      return res.render('treatboxOrders', {
        user: req.user,
        orders,
        totals,
        getReadableOrder,
        querystring,
        priceFormat,
        dateFormat,
        parseDateCode,
        getGoogleMapsUrl,
        treatboxDates
      });
    });

  treatBoxRoutes.route('/orders/swishrefund')
    .all(loginCheck)
    .post(swishRefund);

  treatBoxRoutes.route('/orders/markaspaid/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      try {
        await updateTreatBoxOrders(id, { 'payment.status': 'Paid' });
        return res.json({ status: 'OK' });
      } catch {
        return res.json({ status: 'Error' });
      }
    });

  treatBoxRoutes.route('/orders/markasinvoiced/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      try {
        await updateTreatBoxOrders(id, { 'payment.status': 'Invoiced' });
        return res.json({ status: 'OK' });
      } catch {
        return res.json({ status: 'Error' });
      }
    });

  treatBoxRoutes.route('/orders/cancel/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      try {
        await updateTreatBoxOrders(id, {
          'payment.status': 'Cancelled'
        });
        return res.json({ status: 'OK' });
      } catch {
        return res.json({ status: 'Error' });
      }
    });

  treatBoxRoutes.route('/orders/swapOrder/:recipientCodes')
    .all(loginCheck)
    .get(async (req, res) => {
      const [id1, recipient1, id2, recipient2] = req.params.recipientCodes.split('-');

      // Get values from MongoDB
      let value1;
      let value2;
      let promises = [
        getTreatBoxOrderById(id1),
        getTreatBoxOrderById(id2)
      ];
      let data = await Promise.allSettled(promises);
      if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
        value1 = data[0].value.recipients[recipient1].delivery.order;
        value2 = data[1].value.recipients[recipient2].delivery.order;
      } else {
        return res.json({ status: 'Error' });
      }

      // Set up queries
      const query1 = {};
      query1[`recipients.${recipient1}.delivery.order`] = value2;
      const query2 = {};
      query2[`recipients.${recipient2}.delivery.order`] = value1;

      // Update values in MongoDB
      promises = [
        updateTreatBoxOrders(id1, query1),
        updateTreatBoxOrders(id2, query2)
      ];
      data = await Promise.allSettled(promises);
      if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
        return res.json({ status: 'OK' });
      }
      return res.json({ status: 'Error' });
    });

  treatBoxRoutes.route('/orders/updateSMS/:recipientCode')
    .all(loginCheck)
    .post(async (req, res) => {
      const { recipientCode } = req.params;
      const [id, recipientNumber] = recipientCode.split('-');
      const { message } = req.body;

      const order = await getTreatBoxOrderById(id);
      const link = `sms:${order.recipients[recipientNumber].details.telephone}?body=${encodeURIComponent(querystring.escape(message))}`;
      order.recipients[recipientNumber].delivery.sms = message;
      try {
        updateTreatBoxOrders(id, order);
        return res.json({
          status: 'OK',
          link
        });
      } catch {
        return res.json({ status: 'Error' });
      }
    });

  treatBoxRoutes.route('/orders/getSMS/:recipientCode')
    .all(loginCheck)
    .get(async (req, res) => {
      const { recipientCode } = req.params;
      const [id, recipientNumber] = recipientCode.split('-');

      try {
        const order = await getTreatBoxOrderById(id);
        return res.json({
          status: 'OK',
          message: order.recipients[recipientNumber].delivery.sms
        });
      } catch {
        return res.json({ status: 'Error' });
      }
    });

  treatBoxRoutes.route('/csv/:week')
    .all(loginCheck)
    .get(async (req, res) => {
      const { week } = req.params;
      const orders = await getTreatBoxOrders({
        $and: [
          { 'delivery.date': week },
          { 'delivery.type': { $ne: 'collection' } }
        ]
      });

      const recipients = [];
      orders.forEach((order) => {
        order.recipients.forEach((recipient) => {
          recipients.push(recipient);
        });
      });
      stringify(recipients, {
        header: true,

        columns: [
          { key: 'details.name', header: 'Name' },
          { key: 'details.telephone', header: 'Telephone' },
          { key: 'delivery.address', header: 'Address' },
          { key: 'delivery.addressNotes', header: 'Notes' },
          { key: 'delivery.message', header: 'Message' }
        ]
      }, (error, data) => {
        res.setHeader('Content-disposition', `attachment; filename=${week}.csv`);
        res.set('Content-Type', 'text/csv');
        res.status(200).send(data);
      });
    });

  return treatBoxRoutes;
}

module.exports = routes;
