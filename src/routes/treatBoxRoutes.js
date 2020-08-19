// Page Tag
const tag = 'whisk-management:treatBoxRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const {
  getDetails,
  apiLookupPrice,
  apiLookupRebateCode,
  orderStarted,
  takePayment,
  swishPaymentCallback,
  swishRefundCallback,
  checkSwishStatus,
  swishRefund,
  checkRefundStatus,
  retrieveSwishPayment
} = require('../controllers/treatBoxController')();
const {
  ordersPage,
  markAsPaid,
  markAsInvoiced,
  cancelOrder,
  swapDeliveryOrder,
  getSMS,
  updateSMS,
  getCSV
} = require('../controllers/treatBoxOrdersController')();

function routes() {
  const treatBoxRoutes = express.Router();

  // API to return important information
  treatBoxRoutes.route('/orderdetails')
    .get(getDetails);

  treatBoxRoutes.route('/lookupprice')
    .post(apiLookupPrice);

  treatBoxRoutes.route('/lookuprebate')
    .post(apiLookupRebateCode);

  // Data Validation
  treatBoxRoutes.route('/confirmation')
    .post(orderStarted);

  treatBoxRoutes.route('/takepayment')
    .post(takePayment);

  treatBoxRoutes.route('/checkswishstatus')
    .get(checkSwishStatus);

  treatBoxRoutes.route('/orders/retrieveswish/:id')
    .get(retrieveSwishPayment);

  treatBoxRoutes.route('/swishcallback')
    .post(swishPaymentCallback);

  treatBoxRoutes.route('/swishrefundcallback')
    .post(swishRefundCallback);

  treatBoxRoutes.route('/orders/swishrefund')
    .all(loginCheck)
    .post(swishRefund);

  treatBoxRoutes.route('/orders/checkrefundstatus/:refundId')
    .all(loginCheck)
    .get(checkRefundStatus);

  // Treatbox Orders Page
  treatBoxRoutes.route('/orders')
    .all(loginCheck)
    .get(ordersPage);

  // Treatbox Orders Page Function Calls
  treatBoxRoutes.route('/orders/markaspaid/:id')
    .all(loginCheck)
    .get(markAsPaid);

  treatBoxRoutes.route('/orders/markasinvoiced/:id')
    .all(loginCheck)
    .get(markAsInvoiced);

  treatBoxRoutes.route('/orders/cancel/:id')
    .all(loginCheck)
    .get(cancelOrder);

  treatBoxRoutes.route('/orders/swapOrder/:recipientCodes')
    .all(loginCheck)
    .get(swapDeliveryOrder);

  treatBoxRoutes.route('/orders/getSMS/:recipientCode')
    .all(loginCheck)
    .get(getSMS);

  treatBoxRoutes.route('/orders/updateSMS/:recipientCode')
    .all(loginCheck)
    .post(updateSMS);

  treatBoxRoutes.route('/csv/:week')
    .all(loginCheck)
    .get(getCSV);

  return treatBoxRoutes;
}

module.exports = routes;
