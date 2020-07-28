// Page Tag
const tag = 'whisk-management:boxController';

// Requirements
const moment = require('moment-timezone');
const debug = require('debug')(tag);
const {
  dateFormat
} = require('../functions/helper');

const {
  getTreatBoxDates,
  addBoxLoan,
  getBoxLoans,
  getBoxLoanById,
  updateBoxLoan
} = require('../../lib/db-control/db-control')();
const { sendBoxLoanReminder } = require('../../lib/email/email')();

function boxController() {
  async function showOverview(req, res) {
    const treatboxDates = await getTreatBoxDates();

    // Dates
    const dates = {
      today: dateFormat(moment(), { format: 'dateFormatter' })
    };
    dates.due = dateFormat(moment().add(14, 'days'), { format: 'dateFormatter' });

    // Get customers from database
    const customers = await getBoxLoans();
    customers.forEach((customer, index) => {
      const dateOut = moment(customer.dateOut);
      const dateIn = moment(customer.dateIn);
      customers[index].daysLeft = dateIn.diff(dateOut, 'days');
    });

    return res.render('boxOverview', {
      user: req.user,
      treatboxDates,
      customers,
      dates,
      dateFormat
    });
  }

  async function addLoan(req, res) {
    if (req.body.submit === 'add') {
      const loan = {
        forename: req.body.forename,
        surname: req.body.surname,
        email: req.body.email.toLowerCase(),
        phoneNumber: req.body.mobile.replace(' ', '').replace('-', ''),
        notes: req.body.notes,
        dateOut: req.body.date_out,
        dateIn: req.body.date_in,
        returned: false,
        remindersSent: 0
      };

      // TODO: Verify Input

      try {
        await addBoxLoan(loan);
        req.flash('success', 'Loan Registered!');
      } catch (error) {
        req.flash('danger', 'An Error Happened!');
        // Error
      }
    }

    return res.redirect('/boxes/overview');
  }

  async function editLoan(req, res) {
    const { id } = req.params;

    const loan = {
      forename: req.body.forename,
      surname: req.body.surname,
      email: req.body.email,
      phoneNumber: req.body.mobile,
      notes: req.body.notes,
      dateOut: req.body.date_out,
      dateIn: req.body.date_in
    };

    // TODO: Verify Input

    try {
      await updateBoxLoan(id, { $set: loan });
      req.flash('success', `Details for ${loan.forename} ${loan.surname} updated!`);
    } catch (error) {
      req.flash('danger', 'An Error Happened!');
    }

    return res.redirect('/boxes/overview');
  }

  async function loanReturned(req, res) {
    const { id } = req.params;

    const loan = {
      returned: true
    }

    try {
      await updateBoxLoan(id, { $set: loan });
      req.flash('success', 'Box returned');
    } catch (error) {
      req.flash('danger', 'An Error Happened!');
    }

    return res.redirect('/boxes/overview');
  }

  async function loanReminder(req, res) {
    const { id } = req.params;

    const customer = await getBoxLoanById(id);
    await sendBoxLoanReminder(customer);

    updateBoxLoan(customer._id, { $inc: { remindersSent: 1 } });

    req.flash('success', `Reminder sent to ${customer.email}`);

    return res.redirect('/boxes/overview');
  }

  return {
    showOverview,
    addLoan,
    editLoan,
    loanReturned,
    loanReminder
  };
}

module.exports = boxController;
