// Page Tag
const tag = 'whisk-management:storeRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { storeOrdersPage } = require('../controllers/storeController')();

function routes() {
  const storeRoutes = express.Router();

  storeRoutes.route('/orders')
    .all(loginCheck)
    .get(storeOrdersPage);

  return storeRoutes;
}

module.exports = routes;
