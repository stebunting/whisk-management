// Page Tag
const tag = 'whisk-management:treatBoxController';

// Requirements
const moment = require('moment-timezone');
const debug = require('debug')(tag);
const {
  parseTime,
  priceFormat,
  dateFormat,
  calculateMoms,
  parseMarkers,
  getLatestWeek
} = require('../helpers');
const { verify } = require('../../lib/verify')();
const { sendConfirmationEmail } = require('../../lib/email')();
const {
  insertTreatBoxOrder,
  updateTreatBoxOrders,
  getTreatBoxOrders,
  getTreatBoxOrderById,
  getHighestOrder,
  getSettings,
  getRebateCodes,
  getProducts,
  getProductById,
  recordSwishRefund,
  updateSwishRefundStatus,
  logError
} = require('../../lib/db-control')(tag);
const {
  createPaymentRequest,
  retrievePaymentRequest,
  createRefund,
  retrieveRefund
} = require('../../lib/swish')();

function treatBoxController() {
  // Function to get all relevant dates from a week number
  async function getWeekData(week) {
    let timeframeInformation;
    try {
      timeframeInformation = await getSettings('timeframe');
    } catch (error) {
      return {};
    }

    let { hour, minute } = parseTime(timeframeInformation.delivery.time);
    const data = {
      delivery: moment()
        .tz('Europe/Stockholm')
        .isoWeek(week)
        .day(timeframeInformation.delivery.day)
        .startOf('day')
        .hours(hour)
        .minutes(minute),
      collection: '',
      deadline: {}
    };

    data.collection = data.delivery.clone()
      .day(timeframeInformation.delivery.day - 1)
      .startOf('day')
      .hours(hour)
      .minutes(minute);

    timeframeInformation.deadline.forEach((details) => {
      ({ hour, minute } = parseTime(details.time));
      const date = data.delivery.clone()
        .day(details.day)
        .startOf('day')
        .hours(hour)
        .minutes(minute);
      while (date.isAfter(data.delivery)) {
        date.subtract(1, 'week');
      }
      data.deadline[details.type] = {
        date,
        notPassed: date.isAfter()
      };
    });

    data.week = data.delivery.week();
    data.year = data.delivery.year();
    data.day = data.delivery.day();
    return data;
  }

  function validateDetails(details) {
    return Object.prototype.hasOwnProperty.call(details, 'name')
        && verify(details.name, 'name')
        && Object.prototype.hasOwnProperty.call(details, 'telephone')
        && verify(details.telephone, 'telephone');
  }

  function validateRecipient(recipient) {
    return Object.prototype.hasOwnProperty.call(recipient, 'items')
        && Object.prototype.hasOwnProperty.call(recipient, 'details')
        && validateDetails(recipient.details)
        && Object.prototype.hasOwnProperty.call(recipient, 'delivery')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'address')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'googleFormattedAddress')
        && verify(recipient.delivery.address, 'string')
        && recipient.delivery.address === recipient.delivery.googleFormattedAddress
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'addressNotes')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'zone')
        && verify(recipient.delivery.zone, 'number')
        && Object.prototype.hasOwnProperty.call(recipient.delivery, 'message');
  }

  // Function to validate order
  function validateOrder(order) {
    let valid = Object.prototype.hasOwnProperty.call(order, 'items')
             && Object.prototype.hasOwnProperty.call(order, 'details')
             && validateDetails(order.details)
             && Object.prototype.hasOwnProperty.call(order.details, 'email')
             && verify(order.details.email, 'email')
             && Object.prototype.hasOwnProperty.call(order, 'delivery')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'date')
             && Object.prototype.hasOwnProperty.call(order.delivery, 'type');

    switch (order.delivery.type) {
      case 'collection':
        return valid;

      case 'delivery':
        return valid
            && Object.prototype.hasOwnProperty.call(order, 'recipients')
            && order.recipients.length === 1
            && validateRecipient(order.recipients[0]);

      case 'split-delivery':
        valid = valid
             && Object.prototype.hasOwnProperty.call(order, 'recipients')
             && order.recipients.length >= 1;

        order.recipients.forEach((recipient) => {
          valid = valid && validateRecipient(recipient);
        });

        return valid;

      default:
        return false;
    }
  }

  // Function to convert posted data to an order object
  async function parsePostData(postData) {
    // Get list of products
    const rawProducts = await getProducts();
    const products = {};
    for (let i = 0; i < rawProducts.length; i += 1) {
      /* eslint-disable-next-line no-underscore-dangle */
      products[rawProducts[i]._id] = rawProducts[i].name;
    }

    const order = {
      items: [],
      details: {
        name: postData.name,
        email: postData.email,
        telephone: postData.telephone
      },
      delivery: {
        date: postData.date,
        type: postData['delivery-type']
      }
    };

    const items = Object.entries(postData).filter((x) => x[0].startsWith('quantity-'));
    items.forEach((item) => {
      const [, id] = item[0].split('-');
      const quantity = parseInt(item[1], 10);
      const name = products[id];
      if (quantity > 0) {
        order.items.push({ id, quantity, name });
      }
    });

    if (order.delivery.type === 'collection') {
      order.delivery.notes = postData['collection-notes'];
    } else if (order.delivery.type === 'delivery') {
      const recipient = {
        items: order.items,
        details: {
          name: order.details.name,
          telephone: order.details.telephone
        },
        delivery: {
          address: postData.address,
          addressNotes: postData['notes-address'],
          googleFormattedAddress: postData['google-formatted-address'],
          zone: parseInt(postData.zone, 10),
          message: ''
        }
      };
      order.recipients = [recipient];
    } else if (order.delivery.type === 'split-delivery') {
      const recipients = JSON.parse(postData.recipients);
      const allItems = JSON.parse(postData.items);
      order.recipients = [];

      recipients.forEach((recipient) => {
        let recipientsItems = allItems.filter((x) => x.recipient === recipient);
        const counts = {};
        recipientsItems.forEach((item) => {
          counts[item.id] = {
            quantity: (counts[item.id.quantity] || 0) + 1,
            name: item.name
          };
        });
        recipientsItems = [];
        Object.entries(counts).forEach((item) => {
          recipientsItems.push({
            id: item[0],
            quantity: item[1].quantity,
            name: item[1].name
          });
        });
        const newRecipient = {
          items: recipientsItems,
          details: {
            name: postData[`name-${recipient}`],
            telephone: postData[`telephone-${recipient}`]
          },
          delivery: {
            address: postData[`address-${recipient}`],
            addressNotes: postData[`notes-address-${recipient}`],
            googleFormattedAddress: postData[`google-formatted-address-${recipient}`],
            zone: parseInt(postData[`zone-${recipient}`], 10),
            message: postData[`message-${recipient}`]
          }
        };
        order.recipients.push(newRecipient);
      });
    }

    return order;
  }

  // Return products and timeframes to browser
  async function getDetails(req, res) {
    const productPromise = getProducts();
    let data;
    try {
      data = await getSettings('timeframe');
    } catch {
      return res.json({ status: 'Error' });
    }

    const week = getLatestWeek(data.delivery.day);
    const promises = [getWeekData(week), getWeekData(week + 1)];
    data = await Promise.allSettled(promises);
    const week1 = data[0].value;
    const week2 = data[1].value;
    const timeframe = {
      [`${week1.year}-${week1.week}-${week1.day}`]: week1,
      [`${week2.year}-${week2.week}-${week2.day}`]: week2
    };

    const products = await productPromise;
    return res.json({
      status: 'OK',
      products,
      timeframe
    });
  }

  // Function to look up a rebate code
  async function lookupRebateCode(code) {
    const result = await getRebateCodes({ code: code.toUpperCase() });
    if (result.length === 0 || result[0].active === false) {
      return {
        valid: false,
        message: 'Invalid Code'
      };
    }
    const expired = moment(result[0].expires, 'YYYY-MM-DD').isBefore(moment());
    if (expired) {
      return {
        valid: false,
        message: 'Code Expired'
      };
    }
    return {
      valid: true,
      code: result[0]
    };
  }

  // Function to look up a rebate code from an API
  async function apiLookupRebateCode(req, res) {
    const { code } = req.body;
    const response = await lookupRebateCode(code);
    return res.json(response);
  }

  // Function to generate a statement of costs from products and delivery
  async function lookupPrice(basket, recipients, codes = [], options = {}) {
    const rebateCodes = {
      discountPercent: 0,
      zone3Delivery: false,
      costPrice: false
    };

    if (codes.length > 0) {
      const promises = [];
      for (let i = 0; i < codes.length; i += 1) {
        promises.push(lookupRebateCode(codes[i]));
      }
      const response = await Promise.all(promises);
      for (let i = 0; i < codes.length; i += 1) {
        if (response[i].valid) {
          switch (response[i].code.type) {
            case 'zone3Delivery':
              rebateCodes.zone3Delivery = true;
              break;

            case 'costPrice':
              rebateCodes.costPrice = true;
              break;

            case 'discountPercent':
              rebateCodes.discountPercent = response[i].code.amount;
              break;

            default:
              break;
          }
        }
      }
    }
    const statement = {
      products: [],
      delivery: [],
      bottomLine: {
        foodCost: 0,
        deliveryCost: 0,
        discount: 0,
        foodMoms: 0,
        deliveryMoms: 0,
        discountMoms: 0,
        totalMoms: 0,
        total: 0
      },
      rebateCodes: codes
    };

    // Get Food Cost
    const promises = [];
    for (let i = 0; i < basket.length; i += 1) {
      promises.push(getProductById(basket[i].id));
    }
    const data = await Promise.allSettled(promises);
    const products = [];
    data.forEach((product) => {
      if (product.status === 'fulfilled') {
        products.push(product.value);
      }
    });

    for (let i = 0; i < basket.length; i += 1) {
      // eslint-disable-next-line no-underscore-dangle
      const product = products.filter((x) => x._id.toString() === basket[i].id.toString())[0];

      let price = rebateCodes.costPrice ? product.costPrice : product.grossPrice;
      price = parseInt(price, 10);
      const quantity = parseInt(basket[i].quantity, 10);

      const newProduct = {
        // eslint-disable-next-line no-underscore-dangle
        id: product._id,
        name: product.name,
        quantity,
        price,
        momsAmount: calculateMoms(price, product.momsRate),
        momsRate: product.momsRate,
        subTotal: quantity * price,
        momsSubTotal: calculateMoms(quantity * price, product.momsRate)
      };
      if (options.analyticsRequired === true) {
        newProduct.brand = product.brand;
        newProduct.category = product.category;
      }
      statement.bottomLine.foodCost += newProduct.subTotal;
      statement.bottomLine.foodMoms += newProduct.momsSubTotal;
      statement.bottomLine.totalMoms += newProduct.momsSubTotal;
      statement.bottomLine.total += newProduct.subTotal;
      statement.products.push(newProduct);
    }

    // Get Delivery Cost
    recipients.forEach((recipient) => {
      if (recipient.zone >= 0 && recipient.zone <= 3) {
        let deliveryPrice = null;
        let deliverable = false;
        recipient.products.forEach((item) => {
          // eslint-disable-next-line no-underscore-dangle
          const product = products.filter((x) => x._id.toString() === item.id.toString())[0];
          const itemDelivery = product.delivery.filter((x) => x.zone === recipient.zone)[0];
          deliverable = itemDelivery.deliverable || deliverable
            || (rebateCodes.zone3Delivery
             && product.delivery.filter((x) => x.zone === 2)[0].deliverable);
          if (deliveryPrice === null) {
            deliveryPrice = itemDelivery.price;
          } else {
            deliveryPrice = itemDelivery.price < deliveryPrice ? itemDelivery.price : deliveryPrice;
          }
        });
        if (deliverable) {
          const deliveryObj = {
            recipientId: recipient.id,
            zone: recipient.zone,
            price: deliveryPrice,
            momsRate: 25
          };
          deliveryObj.momsAmount = calculateMoms(deliveryObj.price, deliveryObj.momsRate);
          statement.bottomLine.deliveryCost += deliveryObj.price;
          statement.bottomLine.deliveryMoms += deliveryObj.momsAmount;
          statement.delivery.push(deliveryObj);
        }
      }
    });
    statement.bottomLine.totalMoms += statement.bottomLine.deliveryMoms;
    statement.bottomLine.total += statement.bottomLine.deliveryCost;

    // Calculate Discount
    if (rebateCodes.discountPercent > 0) {
      const multiplier = rebateCodes.discountPercent / 100;
      statement.bottomLine.discount = parseInt(statement.bottomLine.total * multiplier, 10);
      statement.bottomLine.discountMoms = parseInt(statement.bottomLine.totalMoms * multiplier, 10);
      statement.bottomLine.total -= statement.bottomLine.discount;
      statement.bottomLine.totalMoms -= statement.bottomLine.discountMoms;
    }
    return statement;
  }

  // Take properties from req.body and call lookupPrice
  async function apiLookupPrice(req, res) {
    const { basket, recipients } = req.body;
    const codes = req.body.codes.length === 0 ? [] : JSON.parse(req.body.codes);

    try {
      const statement = await lookupPrice(basket, recipients, codes, { analyticsRequired: true });
      statement.status = 'OK';
      return res.json(statement);
    } catch (error) {
      logError({
        message: 'Error calculating price',
        details: JSON.stringify({ basket, recipients, codes }),
        error: error.stack
      });
      return res.json({ status: 'Error' });
    }
  }

  // Function to validate order server-side
  // If valid, redirects to confirmation page, else returns to order form
  async function orderStarted(req, res) {
    const { referer } = req.headers;
    const { 'callback-url': callbackUrl } = req.body;

    const order = await parsePostData(req.body);
    const valid = validateOrder(order);

    if (valid) {
      return res.redirect(307, callbackUrl);
    }
    return res.redirect(307, referer);
  }

  // Function to calculate order price
  async function calculatePrice(order) {
    let recipients = [];
    if (order.delivery.type !== 'collection') {
      recipients = order.recipients.map((recipient, id) => {
        const products = recipient.items.map((item) => ({
          id: item.id,
          quantity: item.quantity
        }));
        return {
          id,
          zone: recipient.delivery.zone,
          products
        };
      });
    }
    const statement = await lookupPrice(
      order.items,
      recipients,
      order.payment.rebateCodes
    );
    return statement;
  }

  // Function to Take Payment
  async function takePayment(req, res) {
    const { method } = req.query;
    const order = await parsePostData(req.body);

    order.payment = {
      method,
      status: 'Ordered'
    };
    if (req.body['rebate-codes'] !== '') {
      order.payment.rebateCodes = JSON.parse(req.body['rebate-codes']);
    }

    const statement = await calculatePrice(order);
    for (let i = statement.delivery.length - 1; i >= 0; i -= 1) {
      if (statement.delivery[i].subTotal === 0) {
        statement.delivery.splice(i, 1);
      }
    }

    order.statement = statement;
    delete order.items;

    if (order.delivery.type !== 'collection') {
      let nextOrder = 0;
      let smsSettings;
      const promises = [
        getHighestOrder(),
        getSettings('sms')
      ];
      await Promise.allSettled(promises).then((data) => {
        if (data[0].status === 'fulfilled') {
          if (data[0].value) {
            nextOrder = data[0].value.highestOrder + 1;
          }
        }
        if (data[1].status === 'fulfilled') {
          smsSettings = data[1].value;
        }
      });

      order.recipients.forEach((recipient, index) => {
        order.recipients[index].delivery.sms = parseMarkers(smsSettings.defaultDelivery, recipient);
        order.recipients[index].delivery.order = nextOrder;
        nextOrder += 1;
      });
    }

    const date = req.body['date-display'];

    if (order.payment.method === 'Invoice') {
      // Insert Invoice Order to DB
      const dbResponse = await insertTreatBoxOrder(order);
      if (dbResponse.insertedCount !== 1) {
        logError({
          message: 'Error inserting Invoice order to DB',
          details: JSON.stringify(dbResponse)
        });
        return res.json({
          status: 'Error',
          errors: ['DB_ERROR']
        });
      }
      const id = dbResponse.insertedId;
      sendConfirmationEmail(order, date);
      return res.json({
        status: 'OK',
        method,
        id
      });
    }

    if (order.payment.method === 'Swish') {
      // Create Swish Payment Request
      const request = await createPaymentRequest({
        payerTelephone: order.details.telephone,
        amount: order.statement.bottomLine.total
      });
      if (request.status === 'OK') {
        order.payment.swish = request.data;
        order.payment.swish.refunds = [];
      } else {
        return res.json(request);
      }

      // Insert Swish Order to DB
      const dbResponse = await insertTreatBoxOrder(order);
      const id = dbResponse.insertedId;
      if (dbResponse.insertedCount !== 1) {
        logError({
          message: 'Error inserting Swish order to DB',
          details: JSON.stringify(dbResponse)
        });
        return {
          status: 'Error',
          errors: ['DB_ERROR']
        };
      }
      sendConfirmationEmail(order);
      return res.json({
        status: 'OK',
        method,
        id
      });
    }

    return res.json({
      status: 'Error',
      errors: ['SERVER_ERROR']
    });
  }

  function updateSwishOrder(order, response) {
    const updatedOrder = order;
    if (response.status === 'PAID') {
      updatedOrder.payment.status = 'Paid';
    }
    updatedOrder.payment.swish.reference = response.paymentReference;
    // eslint-disable-next-line no-underscore-dangle
    updateTreatBoxOrders(order._id, updatedOrder);
  }

  // Function Swish callsback on payment request
  async function swishPaymentCallback(req, res) {
    const response = req.body;
    const [order] = await getTreatBoxOrders({ 'payment.swish.id': response.id });
    if (order != null) {
      updateSwishOrder(order, response);
    }
    return res.json({ status: 'OK' });
  }

  async function swishRefundCallback(req, res) {
    const { id, status } = req.body;
    updateSwishRefundStatus(id, status);
    return res.send({ status: 'OK' });
  }

  // Function to get payment status
  async function checkSwishStatus(req, res) {
    // Check Database First
    const order = await getTreatBoxOrderById(req.query.id);
    if (order.payment.status === 'Paid') {
      return res.json({
        status: 'OK',
        paymentStatus: 'Paid'
      });
    }

    // Check Swish
    const response = await retrievePaymentRequest(order.payment.swish.id);
    updateSwishOrder(order, response);
    if (response.status === 'PAID') {
      return res.json({ status: 'OK' });
    }
    if (response.status === 'ERROR') {
      return res.json({
        status: 'Error',
        errors: [response.status.errorCode]
      });
    }
    if (response.status === 'DECLINED' || response.status === 'CANCELLED') {
      return res.json({
        status: 'Error',
        errors: [response.status]
      });
    }
    return res.json({
      status: 'OK',
      paymentStatus: response.status
    });
  }

  // Create Swish Refund
  async function swishRefund(req, res) {
    const { id: orderId, amount } = req.body;
    const order = await getTreatBoxOrderById(orderId);

    const refundOptions = {
      paymentReference: order.payment.swish.reference,
      amount: amount * 100
    };
    const request = await createRefund(refundOptions);
    const { id: refundId } = request.data;
    if (request.status === 'OK') {
      // Store to DB
      recordSwishRefund(orderId, {
        timestamp: new Date(),
        id: refundId,
        amount: parseInt(amount, 10) * 100,
        status: 'CREATED'
      });
      return res.json({
        status: 'OK',
        refundId,
        orderId
      });
    }
    return res.json(request);
  }

  // Function to get payment status
  async function checkRefundStatus(req, res) {
    const { refundId } = req.params;
    const [order] = await getTreatBoxOrders({ 'payment.swish.refunds.id': refundId });
    const [refund] = order.payment.swish.refunds.filter((x) => x.id === refundId);

    const response = await retrieveRefund(refundId);
    updateSwishRefundStatus(response.id, response.status);
    if (response.status === 'DECLINED' || response.status === 'CANCELLED' || response.status === 'ERROR') {
      return res.json({
        status: 'Error',
        errors: [response.status.errorCode]
      });
    }
    return res.json({
      status: 'OK',
      refundStatus: response.status,
      data: {
        hi: 'hi',
        timestamp: dateFormat(refund.timestamp, { format: 'short' }),
        amount: priceFormat(refund.amount)
      }
    });
  }

  async function retrieveSwishPayment(req, res) {
    const { id } = req.params;
    const response = await retrievePaymentRequest(id);
    return res.json(response);
  }

  return {
    getWeekData,
    getDetails,
    apiLookupPrice,
    apiLookupRebateCode,
    orderStarted,
    takePayment,
    swishPaymentCallback,
    swishRefundCallback,
    checkSwishStatus,
    swishRefund,
    checkRefundStatus,
    retrieveSwishPayment,
    calculatePrice
  };
}

module.exports = treatBoxController;
