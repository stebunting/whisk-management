// Page Tag
const tag = 'whisk-management:treatBoxRoutes';
const stringify = require('csv-stringify');

// Requirements
const express = require('express');
const querystring = require('querystring');
const moment = require('moment-timezone');
const debug = require('debug')(tag);
const {
  getTreatBoxOrders,
  getTreatBoxOrderById,
  updateTreatBoxOrders,
  getTreatBoxTotals
} = require('../../lib/db-control/db-control')(tag);
const { getReadableOrder, getWeek } = require('../functions/helper');
const { loginCheck } = require('../controllers/authController')();
const {
  getWeekData,
  getDetails,
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

  treatBoxRoutes.route('/lookuprebate')
    .get(lookupRebateCode);

  // Data Validation
  treatBoxRoutes.route('/confirmation')
    .post(orderStarted);

  // Invoice payment route
  treatBoxRoutes.route('/invoicepayment')
    .post(orderConfirmed);

  treatBoxRoutes.route('/swishcallback')
    .post((req, res) => {
      debug(req.body);
      return res.send('ok');
    });

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
        query = { 'delivery.date': dateCode };
      } else if (date === 'nextweek') {
        const week = getWeek(1);
        const year = moment().week(week).year();
        const dateCode = `${year}-${week}`;
        query = { 'delivery.date': dateCode };
      } else {
        query = { 'delivery.date': date };
      }

      const promises = [
        getTreatBoxOrders(query),
        getTreatBoxTotals(query)
      ];
      let orders;
      let totals;
      await Promise.allSettled(promises)
        .then((data) => {
          if (data[0].status === 'fulfilled') {
            orders = data[0].value;
          }
          if (data[1].status === 'fulfilled') {
            totals = data[1].value;
          }
        });

      return res.render('treatboxOrders', {
        user: req.user,
        orders,
        totals,
        getWeekData,
        getReadableOrder,
        querystring
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
        await updateTreatBoxOrders(id, { 'payment.status': 'Cancelled' });
        return res.json({ status: 'OK' });
      } catch {
        return res.json({ status: 'Error' });
      }
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
