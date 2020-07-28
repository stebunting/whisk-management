// Page Tag
const tag = 'whisk-management:boxRoutes';

// Requirements
const express = require('express');
const { loginCheck } = require('../controllers/authController')();
const {
  showOverview,
  addLoan,
  editLoan,
  loanReturned
} = require('../controllers/boxController')();

function routes() {
  const boxRoutes = express.Router();

  boxRoutes.route('/overview')
    .all(loginCheck)
    .get(showOverview);

  boxRoutes.route('/add')
    .post(addLoan)

  boxRoutes.route('/edit/:id')
    .post(editLoan)

  boxRoutes.route('/return/:id')
    .post(loanReturned)

  return boxRoutes;
}

module.exports = routes;
