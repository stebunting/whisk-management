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
    .get((req, res) => res.json(req.user));

  return userRoutes;
}

module.exports = routes;
