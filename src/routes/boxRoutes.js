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

  boxRoutes.route('/migrate')
    .get(async (req, res) => {
      const mysql = require('mysql');
      const moment = require('moment-timezone');
      const { addBoxLoan } = require('../../lib/db-control')();

      const connection = mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
      });
      connection.connect();

      connection.query('SELECT * FROM boxes ORDER BY customer_id ASC', (error, results) => {
        results.forEach((entry) => {
          debug(entry);
          const doc = {
            forename: entry.forename,
            surname: entry.surname,
            email: entry.email,
            phoneNumber: entry.phone_number,
            notes: entry.notes,
            dateOut: moment(entry.date_out).add(2, 'hours').format('YYYY-MM-DD'),
            dateIn: moment(entry.date_in).add(2, 'hours').format('YYYY-MM-DD'),
            returned: entry.returned,
            remindersSent: entry.reminders_sent
          };
          addBoxLoan(doc);
        });

        connection.end();
        return res.json({});
      });
    });

  return boxRoutes;
}

module.exports = routes;
