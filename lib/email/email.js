// Page Tag
const tag = 'whisk-management:email';

// Requirements
const nodemailer = require('nodemailer');
const debug = require('debug')(tag);

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
      transporter.verify()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function createTransporter() {
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

  function sendConfirmationEmail(order) {
    const sender = 'steve@stevebunting.com';
    const emailConfig = {
      from: sender,
      to: order.purchaser.email,
      bcc: sender,
      subject: 'Thanks for your order from Whisk',
      text: 'Thanks for ordering some stuff from us.'
    };

    return new Promise((resolve, reject) => {
      isConnected()
        .then((data) => {
          if (data) {
            return transporter.sendMail(emailConfig)
          } else {
            return reject(data);
          }
        })
        .then((response) => resolve(response))
        .catch((error) => reject(error));
    });
  }

  return {
    isConnected,
    createTransporter,
    sendConfirmationEmail
  };
}

module.exports = email;
