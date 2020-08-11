// Page Tag
const tag = 'whisk-management:boxRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const {
  showOverview,
  newLoan,
  addLoan,
  editLoan,
  loanReturned,
  loanReminder,
  schedule
} = require('../controllers/boxController')();

function routes() {
  const boxRoutes = express.Router();

  boxRoutes.route('/overview')
    .all(loginCheck)
    .get(showOverview);

  boxRoutes.route('/newloan')
    .all(loginCheck)
    .get(newLoan);

  boxRoutes.route('/add')
    .all(loginCheck)
    .post(addLoan);

  boxRoutes.route('/edit/:id')
    .all(loginCheck)
    .post(editLoan);

  boxRoutes.route('/return/:id')
    .all(loginCheck)
    .post(loanReturned);

  boxRoutes.route('/remind/:id')
    .all(loginCheck)
    .post(loanReminder);

  boxRoutes.route('/schedule')
    .get(schedule);

  return boxRoutes;
}

module.exports = routes;
