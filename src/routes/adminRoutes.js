// Page Tag
const tag = 'whisk-management:adminRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { setupDb } = require('../../lib/db-control/db-control')(tag);

function routes() {
  const adminRoutes = express.Router();

  adminRoutes.use(loginCheck);
  adminRoutes.route('/setupdb')
    .get(async (req, res) => {
      try {
        await setupDb();
        return res.send('Database Setup Complete');
      } catch (error) {
        debug(error);
        return res.send(error.stack);
      }
    });

  return adminRoutes;
}

module.exports = routes;
