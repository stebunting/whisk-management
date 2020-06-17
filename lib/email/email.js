// Page Tag
const tag = 'whisk-management:email';

// Requirements
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const debug = require('debug')(tag);
const { getFormattedDeliveryDate, getReadableOrder } = require('../../src/functions/helper');

// Global Variables
const smtpServer = process.env.SMTP_SERVER;
const smtpUsername = process.env.SMTP_USERNAME;
const smtpPassword = process.env.SMTP_PASSWORD;
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

  async function sendConfirmationEmail(order) {
    const deliveryDate = getFormattedDeliveryDate(order.delivery.date);
    let html;
    let text;
    try {
      html = await ejs.renderFile('src/views/email-template.ejs', {
        order,
        deliveryDate,
        getReadableOrder
      });
      text = await ejs.renderFile('src/views/plaintext-template.ejs', {
        order,
        deliveryDate,
        getReadableOrder
      });
    } catch (error) {
      debug(error);
    }
    const sender = 'hello@whisk.se';
    const emailConfig = {
      from: sender,
      to: order.details.email,
      subject: 'WHISK Order',
      text,
      html
    };

    return new Promise((resolve, reject) => {
      isConnected()
        .then((data) => {
          if (data) {
            return transporter.sendMail(emailConfig);
          }
          return reject(data);
        })
        .then((response) => resolve(response))
        .catch((error) => reject(error));
    });
  }

  return {
    isConnected,
    connect,
    sendConfirmationEmail
  };
}

module.exports = email;
