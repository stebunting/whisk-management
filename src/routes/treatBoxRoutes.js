// Page Tag
const tag = 'whisk-management:treatBoxRoutes';
const stringify = require('csv-stringify');

// Requirements
const express = require('express');
const querystring = require('querystring');
const debug = require('debug')(tag);
const {
  getTreatBoxOrders,
  getTreatBoxOrderById,
  updateTreatBoxOrders,
  getTreatBoxTotals
} = require('../../lib/db-control/db-control')(tag);
const { getReadableOrder } = require('../functions/helper');
const { loginCheck } = require('../controllers/authController')();
const {
  getWeekData,
  getDetails,
  lookupRebateCode,
  orderStarted,
  orderConfirmed
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
    .post(async (req, res) => {
      if (req.body.submit === 'update-sms') {
        const id = req.body['order-id'];
        const recipientNumber = req.body['recipient-number'];
        
        const order = await getTreatBoxOrderById(id);
        order.recipients[recipientNumber].delivery.sms = req.body['sms-text'];
        updateTreatBoxOrders(id, order);
      }
      return res.redirect('/treatbox/orders');
    })
    .get(async (req, res) => {
      const orders = await getTreatBoxOrders();
      const totals = await getTreatBoxTotals();

      res.render('treatboxOrders', {
        user: req.user,
        orders,
        totals,
        getWeekData,
        getReadableOrder,
        querystring
      });
    });

  treatBoxRoutes.route('/orders/markaspaid/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      await updateTreatBoxOrders(id, { 'payment.paid': true });
      return res.redirect('/treatbox/orders');
    });

  treatBoxRoutes.route('/orders/markasinvoiced/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      await updateTreatBoxOrders(id, { 'payment.invoiced': true });
      return res.redirect('/treatbox/orders');
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

      let recipients = [];
      orders.forEach((order) => {
        order.recipients.forEach((recipient) => {
          recipients.push(recipient);
        })
      })
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
