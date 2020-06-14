// Page Tag
const tag = 'whisk-management:treatBoxRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const {
  insertTreatBoxOrder,
  getTreatBoxOrders,
  updateTreatBoxOrders,
  getTreatBoxTotals
} = require('../../lib/db-control/db-control')(tag);
const { sendConfirmationEmail } = require('../../lib/email/email')();
const { loginCheck } = require('../controllers/authController')();
const {
  getWeekData,
  getDetails,
  orderStarted,
  orderConfirmed
} = require('../controllers/treatBoxController')();

function routes() {
  const treatBoxRoutes = express.Router();

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

  // API to return important information
  treatBoxRoutes.route('/orderdetails')
    .get(getDetails);

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
