// Page Tag
const tag = 'whisk-management:userRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();

function routes() {
  const userRoutes = express.Router();

  userRoutes.use(loginCheck);
  userRoutes.route('/dashboard')
    .get((req, res) => {

      return res.render('dashboard.ejs');
    });

  return userRoutes;
}

module.exports = routes;
