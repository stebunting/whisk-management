// Page Tag
const tag = 'whisk-management:treatBoxRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const {
  getTreatBoxOrders,
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
    .get(async (req, res) => {
      const orders = await getTreatBoxOrders();
      const totals = await getTreatBoxTotals();

      res.render('treatboxOrders', {
        user: req.user,
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

  treatBoxRoutes.route('/orders/markasinvoiced/:id')
    .all(loginCheck)
    .get(async (req, res) => {
      const { id } = req.params;
      await updateTreatBoxOrders(id, { 'payment.invoiced': true });
      return res.redirect('/treatbox/orders');
    });

  return treatBoxRoutes;
}

module.exports = routes;
