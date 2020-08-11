// Page Tag
const tag = 'whisk-management:treatBoxOrdersController';

// Requirements
const moment = require('moment-timezone');
const querystring = require('querystring');
const stringify = require('csv-stringify');
const debug = require('debug')(tag);
const {
  getTreatBoxOrders,
  getTreatBoxOrderById,
  getRecipients,
  getTreatBoxTotals,
  getTreatBoxDates,
  updateTreatBoxOrders,
  getSettings
} = require('../../lib/db-control')(tag);
const {
  priceFormat,
  dateFormat,
  getReadableOrder,
  getLatestWeek,
  parseDateCode,
  getGoogleMapsUrl,
  getGoogleMapsDirections
} = require('../helpers');

function treatBoxOrdersController() {
  // Display Treatbox Orders Page
  async function ordersPage(req, res) {
    const timeframeSettings = await getSettings('timeframe');
    const deliveryDay = timeframeSettings.delivery.day;
    const { date } = req.query;

    let query;
    if (date === undefined) {
      query = {};
    } else if (date === 'thisweek') {
      const week = getLatestWeek(deliveryDay);
      const year = moment().week(week).year();
      const dateCode = `${year}-${week}-3`;
      query = { 'delivery.date': { $regex: `^${dateCode}` } };
    } else if (date === 'nextweek') {
      const week = getLatestWeek(deliveryDay, 1);
      const year = moment().week(week).year();
      const dateCode = `${year}-${week}-3`;
      query = { 'delivery.date': { $regex: `^${dateCode}` } };
    } else if (date === 'lastweek') {
      const week = getLatestWeek(deliveryDay, -1);
      const year = moment().week(week).year();
      const dateCode = `${year}-${week}-3`;
      query = { 'delivery.date': { $regex: `^${dateCode}` } };
    } else {
      query = { 'delivery.date': date };
    }

    const promises = [
      getRecipients(query),
      getTreatBoxTotals(query),
      getTreatBoxDates()
    ];
    let orders;
    let totals;
    let treatboxDates;
    const data = await Promise.allSettled(promises);
    if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
      orders = data[0].value;
      totals = data[1].value;
      treatboxDates = data[2].value;
    }

    return res.render('treatboxOrders', {
      user: req.user,
      orders,
      totals,
      getReadableOrder,
      querystring,
      priceFormat,
      dateFormat,
      parseDateCode,
      getGoogleMapsUrl,
      getGoogleMapsDirections,
      treatboxDates
    });
  }

  async function markAsPaid(req, res) {
    const { id } = req.params;
    try {
      await updateTreatBoxOrders(id, { 'payment.status': 'Paid' });
      return res.json({ status: 'OK' });
    } catch {
      return res.json({ status: 'Error' });
    }
  }

  async function markAsInvoiced(req, res) {
    const { id } = req.params;
    try {
      await updateTreatBoxOrders(id, { 'payment.status': 'Invoiced' });
      return res.json({ status: 'OK' });
    } catch {
      return res.json({ status: 'Error' });
    }
  }

  async function cancelOrder(req, res) {
    const { id } = req.params;
    try {
      await updateTreatBoxOrders(id, {
        'payment.status': 'Cancelled'
      });
      return res.json({ status: 'OK' });
    } catch {
      return res.json({ status: 'Error' });
    }
  }

  async function swapDeliveryOrder(req, res) {
    const [id1, recipient1, id2, recipient2] = req.params.recipientCodes.split('-');

    // Get values from MongoDB
    let value1;
    let value2;
    let promises = [
      getTreatBoxOrderById(id1),
      getTreatBoxOrderById(id2)
    ];
    let data = await Promise.allSettled(promises);
    if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
      value1 = data[0].value.recipients[recipient1].delivery.order;
      value2 = data[1].value.recipients[recipient2].delivery.order;
    } else {
      return res.json({ status: 'Error' });
    }

    // Set up queries
    const query1 = {};
    query1[`recipients.${recipient1}.delivery.order`] = value2;
    const query2 = {};
    query2[`recipients.${recipient2}.delivery.order`] = value1;

    // Update values in MongoDB
    promises = [
      updateTreatBoxOrders(id1, query1),
      updateTreatBoxOrders(id2, query2)
    ];
    data = await Promise.allSettled(promises);
    if (data[0].status === 'fulfilled' && data[1].status === 'fulfilled') {
      return res.json({ status: 'OK' });
    }
    return res.json({ status: 'Error' });
  }

  async function getSMS(req, res) {
    const { recipientCode } = req.params;
    const [id, recipientNumber] = recipientCode.split('-');

    try {
      const order = await getTreatBoxOrderById(id);
      return res.json({
        status: 'OK',
        message: order.recipients[recipientNumber].delivery.sms
      });
    } catch {
      return res.json({ status: 'Error' });
    }
  }

  async function updateSMS(req, res) {
    const { recipientCode } = req.params;
    const [id, recipientNumber] = recipientCode.split('-');
    const { message } = req.body;

    const order = await getTreatBoxOrderById(id);
    const link = `sms:${order.recipients[recipientNumber].details.telephone}?body=${encodeURIComponent(querystring.escape(message))}`;
    order.recipients[recipientNumber].delivery.sms = message;
    try {
      updateTreatBoxOrders(id, order);
      return res.json({
        status: 'OK',
        link
      });
    } catch {
      return res.json({ status: 'Error' });
    }
  }

  async function getCSV(req, res) {
    const { week } = req.params;
    const orders = await getTreatBoxOrders({
      $and: [
        { 'delivery.date': week },
        { 'delivery.type': { $ne: 'collection' } }
      ]
    });

    const recipients = [];
    orders.forEach((order) => {
      order.recipients.forEach((recipient) => {
        recipients.push(recipient);
      });
    });
    stringify(recipients, {
      header: true,

      columns: [
        { key: 'details.name', header: 'Name' },
        { key: 'details.telephone', header: 'Telephone' },
        { key: 'delivery.address', header: 'Address' },
        { key: 'delivery.addressNotes', header: 'Notes' },
        { key: 'delivery.message', header: 'Message' }
      ]
    }, (error, data) => {
      res.setHeader('Content-disposition', `attachment; filename=${week}.csv`);
      res.set('Content-Type', 'text/csv');
      res.status(200).send(data);
    });
  }

  return {
    ordersPage,
    markAsPaid,
    markAsInvoiced,
    cancelOrder,
    swapDeliveryOrder,
    getSMS,
    updateSMS,
    getCSV
  };
}

module.exports = treatBoxOrdersController;
