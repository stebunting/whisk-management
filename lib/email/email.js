// Page Tag
const tag = 'whisk-management:email';

// Requirements
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const debug = require('debug')(tag);
const {
  priceFormat,
  dateFormat,
  getFormattedDeliveryDate,
  getReadableOrder
} = require('../../src/functions/helper');

// Global Variables
const smtpServer = process.env.SMTP_SERVER;
const smtpUsername = process.env.SMTP_USERNAME;
const smtpPassword = process.env.SMTP_PASSWORD;
const sender = 'hello@whisk.se';
let transporter;

function email() {
  function isConnected() {
    return new Promise((resolve, reject) => {
      if (transporter == null) {
        return reject(new Error('Not connected to SMTP server'));
      }
      return transporter.verify()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function connect() {
    transporter = nodemailer.createTransport({
      host: smtpServer,
      port: 465,
      secure: true,
      auth: {
        user: smtpUsername,
        pass: smtpPassword
      }
    });
    return new Promise((resolve, reject) => {
      isConnected()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function sendEmail(config) {
    return new Promise((resolve, reject) => {
      isConnected()
        .then((data) => {
          if (data) {
            return transporter.sendMail(config);
          }
          return reject(data);
        })
        .then((response) => resolve(response))
        .catch((error) => reject(error));
    });
  }

  // Function to send reminder for box loans
  async function sendBoxLoanReminder(user) {
    const emailConfig = {
      from: sender,
      to: user.email,
      subject: 'WHISK || Reminder'
    };

    emailConfig.text = `Hello ${user.forename},\n\nJust a reminder that your box is due back on ${dateFormat(user.dateIn, { format: 'long' })}.\n\nTeam WHISK`;
    try {
      emailConfig.html = await ejs.renderFile('src/views/box-reminder-template.ejs', {
        user,
        dateFormat
      });
    } catch (error) {
      debug(error);
    }

    return sendEmail(emailConfig);
  }

  // Function to send final reminder for box loans
  async function sendBoxLoanFinalReminder(user) {
    const emailConfig = {
      from: sender,
      to: user.email,
      subject: 'WHISK || Final Reminder'
    };

    emailConfig.text = `Hello ${user.forename},\n\nYour box is now due back on ${dateFormat(user.dateIn, { format: 'long' })}.\n\nIf it's not returned in the next two days you will be charged 750kr.\n\nTeam WHISK`;
    try {
      emailConfig.html = await ejs.renderFile('src/views/box-final-reminder-template.ejs', {
        user,
        dateFormat
      });
    } catch (error) {
      debug(error);
    }

    return sendEmail(emailConfig);
  }

  async function sendConfirmationEmail(order) {
    const deliveryDate = getFormattedDeliveryDate(order.delivery.date);
    let html;
    let text;
    try {
      html = await ejs.renderFile('src/views/email-template.ejs', {
        order,
        deliveryDate,
        getReadableOrder,
        priceFormat
      });
      text = await ejs.renderFile('src/views/plaintext-template.ejs', {
        order,
        deliveryDate,
        getReadableOrder,
        priceFormat
      });
    } catch (error) {
      debug(error);
    }

    const emailConfig = {
      from: sender,
      to: order.details.email,
      subject: 'WHISK Order',
      text,
      html
    };

    return sendEmail(emailConfig);
  }

  return {
    isConnected,
    connect,
    sendBoxLoanReminder,
    sendBoxLoanFinalReminder,
    sendConfirmationEmail
  };
}

module.exports = email;
