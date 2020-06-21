// Requirements
const querystring = require('querystring');
const moment = require('moment-timezone');

// Format price from stored öre to krona
function priceFormat(num) {
  const str = (num / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return parseInt(str.replace(',', ''), 10);
}

// Function to calculate MOMs amount from a final sale price (rounded to nearest krona)
function calculateMoms(price, rate) {
  const decimalRate = 1 + (rate / 100);
  return Math.round(price * decimalRate - price);
}

// Function to return a Google Maps URL from an address
function getGoogleMapsUrl(address) {
  const q = querystring.stringify({
    api: 1,
    query: address
  });
  return `https://www.google.com/maps/search/?${q}`;
}

// Convert year / date to formatted string
function getFormattedDeliveryDate(date) {
  const [year, week] = date.split('-');
  return moment()
    .week(week)
    .year(year)
    .startOf('isoWeek')
    .add(2, 'days')
    .format('dddd Do MMMM YYYY');
}

// Return readable order description
function getReadableOrder(order) {
  let str = '';
  if (order.comboBoxes > 0) {
    str = `${str}${order.comboBoxes} x Combo Box${order.comboBoxes !== 1 ? 'es' : ''}`;
  }
  if (order.treatBoxes > 0) {
    str = `${str}${str.length > 0 ? ', ' : ''}${order.treatBoxes} x Treat Box${order.treatBoxes !== 1 ? 'es' : ''}`;
  }
  if (order.vegetableBoxes > 0) {
    str = `${str}${str.length > 0 ? ', ' : ''}${order.vegetableBoxes} x Vegetable Box${order.vegetableBoxes !== 1 ? 'es' : ''}`;
  }
  return str;
}

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function parseMarkers(str, recipient) {
  let parsedString = str;

  let order = 'Treat Box';
  if (recipient.items.comboBoxes > 0 || recipient.items.vegetableBoxes > 0) {
    order = `Veggie & ${order}`;
  }
  if (recipient.items.comboBoxes + recipient.items.treatBoxes + recipient.items.vegetableBoxes > 1) {
    order = `${order}es`;
  }

  const markers = {
    '%name': recipient.details.name,
    '%message': (recipient.delivery.message !== '') ? `\n${recipient.delivery.message}\n` : '',
    '%order': order
  };
  Object.keys(markers).forEach((key) => {
    parsedString = parsedString.replace(key, markers[key]);
  });
  return parsedString;
}

module.exports = {
  priceFormat,
  getGoogleMapsUrl,
  getFormattedDeliveryDate,
  getReadableOrder,
  generateRandomString,
  parseMarkers
};
