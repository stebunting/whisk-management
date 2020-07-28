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
const {
  sendBoxLoanReminder,
  sendBoxLoanFinalReminder
} = require('../../lib/email/email')();

// Calculate days left for each customer
function getDaysLeft(customers) {
  customers.forEach((customer, index) => {
    if (!customer.returned) {
      const dateOut = moment(customer.dateOut);
      const dateIn = moment(customer.dateIn);
      customers[index].daysLeft = dateIn.diff(dateOut, 'days');
    }
  });
  return customers;
}

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
    getDaysLeft(customers);

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

  async function schedule(req, res) {
    const customers = await getBoxLoans({ returned: false });
    getDaysLeft(customers);
    const reminders = {
      status: 'OK',
      reminders: 0,
      finalReminders: 0
    }

    customers.forEach((customer) => {
      if (customer.daysLeft === 7) {
        sendBoxLoanReminder(customer);
        updateBoxLoan(customer._id, { $inc: { remindersSent: 1 } });
        reminders.reminders += 1;
      } else if (customer.daysLeft === 0) {
        sendBoxLoanFinalReminder(customer);
        updateBoxLoan(customer._id, { $inc: { remindersSent: 1 } });
        reminders.finalReminders += 1;
      }
    })

    return res.json(reminders);
  }

  return {
    showOverview,
    addLoan,
    editLoan,
    loanReturned,
    loanReminder,
    schedule
  };
}

module.exports = boxController;
