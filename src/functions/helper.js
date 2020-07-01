// Requirements
const querystring = require('querystring');
const moment = require('moment-timezone');
const { getProductById } = require('../../lib/db-control/db-control');

// Format price from stored öre to krona
function priceFormat(num, userOptions = {}) {
  const options = {
    includeSymbol: userOptions.includeSymbol || true,
    includeOre: userOptions.includeOre || false
  }
  let str = (num / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options.includeOre ? 2 : 0
  });
  str = str.replace(',', '');
  str += options.includeSymbol ? ' SEK' : '';
  return str;
}

// Function to calculate MOMs amount from a final sale price (rounded to nearest krona)
function calculateMoms(gross, momsRate) {
  const decimalRate = 1 + (momsRate / 100);
  return Math.round(gross - (gross / decimalRate));
}

// Function to calculate MOMs amount from a final sale price (rounded to nearest krona)
function calculateNetCost(gross, momsRate) {
  const decimalRate = 1 + (momsRate / 100);
  return Math.round(gross / decimalRate);
}

// Function to return a Google Maps URL from an address
function getGoogleMapsUrl(address) {
  const q = querystring.stringify({
    api: 1,
    query: address
  });
  return `https://www.google.com/maps/search/?${q}`;
}

function getWeek(offset = 0) {
  if (moment().isoWeekday() < 3) {
    return moment().add(offset, 'weeks').week();
  }
  return moment().add(1 + offset, 'weeks').week();
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
function getReadableOrder(items) {
  const list = [];
  items.forEach((item) => {
    list.push(`${item.quantity} x ${item.id}`);
  });
  return list.join(', ');
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
  calculateMoms,
  calculateNetCost,
  getGoogleMapsUrl,
  getWeek,
  getFormattedDeliveryDate,
  getReadableOrder,
  generateRandomString,
  parseMarkers
};
