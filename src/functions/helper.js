// Requirements
const querystring = require('querystring');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const { getProductById } = require('../../lib/db-control/db-control');

// Format price from stored öre to krona
function priceFormat(num, userOptions = {}) {
  const options = {
    includeOre: userOptions.includeOre || false
  }
  if (userOptions.includeSymbol === false) {
    options['includeSymbol'] = false;
  } else {
    options['includeSymbol'] = true;
  }
  let str = (num / 100).toLocaleString(undefined, {
    minimumFractionDigits: options.includeOre ? 2 : 0,
    maximumFractionDigits: options.includeOre ? 2 : 0
  });
  str = str.replace(',', '');
  str += options.includeSymbol ? ' SEK' : '';
  return str;
}

function dateFormat(date, userOptions = {}) {
  let preferredFormat;
  switch (userOptions.format) {
    case 'short':
      preferredFormat = 'YYYY/M/D h:mm:ssa';
      break;

    case 'date':
      preferredFormat = 'D/M/YYYY';
      break;

    case 'time':
      preferredFormat = 'h:mm A';
      break;

    case 'long':
    default:
      preferredFormat = 'dddd Do MMMM YYYY'
      break;
  }
  if (userOptions.includeWeek === true) {
    preferredFormat += ' [(Week] w[)]';
  }
  return moment(date)
    .tz('Europe/Stockholm')
    .format(preferredFormat);
}

// Function to calculate MOMs amount from a final sale price (rounded to nearest krona)
function calculateMoms(gross, momsRate) {
  const decimalRate = 1 + (momsRate / 100);
  return gross - (gross / decimalRate);
}

// Function to calculate MOMs amount from a final sale price (rounded to nearest krona)
function calculateNetCost(gross, momsRate) {
  const decimalRate = 1 + (momsRate / 100);
  return gross / decimalRate;
}

// Function to return a Google Maps URL from an address
function getGoogleMapsUrl(address) {
  const q = querystring.stringify({
    api: 1,
    query: address
  });
  return `https://www.google.com/maps/search/?${q}`;
}

// Function to return a Google Maps URL from an address
function getGoogleMapsDirections(address) {
  const q = querystring.stringify({
    api: 1,
    destination: address,
    travelmode: 'driving',
    dir_action: 'navigate'
  });
  return `https://www.google.com/maps/dir/?${q}`;
}

function getWeek(offset = 0) {
  if (moment().isoWeekday() <= 3) {
    return moment().add(offset, 'weeks').isoWeek();
  }
  return moment().add(1 + offset, 'weeks').isoWeek();
}

// Convert year / date to formatted string
function getFormattedDeliveryDate(date, userOptions = {}) {
  const format = userOptions.displayWeek ? 'dddd Do MMMM YYYY [(Week ]W[)]' : 'dddd Do MMMM YYYY';
  const [year, week, day] = date.split('-');
  return moment()
    .week(week)
    .year(year)
    .day(day)
    .format(format);
}

// Parse Date Code
function parseDateCode(code) {
  const [year, week, day] = code.split('-');
  return {
    date: moment().tz('Europe/Stockholm').year(year).week(week).day(day).format(),
    year,
    week,
    day
  };
}

// Return readable order description
function getReadableOrder(items) {
  const list = [];
  items.forEach((item) => {
    list.push(`${item.quantity} x ${item.name}`);
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

// Function to return a UUID suitable for Swish (32 characters, no dashes, capitals)
function getSwishUUID() {
  return uuidv4().replace(/-/g, '').toUpperCase();
}

module.exports = {
  priceFormat,
  dateFormat,
  calculateMoms,
  calculateNetCost,
  getGoogleMapsUrl,
  getGoogleMapsDirections,
  getWeek,
  parseDateCode,
  getFormattedDeliveryDate,
  getReadableOrder,
  generateRandomString,
  parseMarkers,
  getSwishUUID
};
