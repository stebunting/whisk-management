// Requirements
const querystring = require('querystring');
const moment = require('moment-timezone');

// Format price from stored öre to krona
function priceFormat(n, userOptions = {}) {
  const options = {
    includeOre: userOptions.includeOre || false
  };
  if (userOptions.includeSymbol === false) {
    options.includeSymbol = false;
  } else {
    options.includeSymbol = true;
  }
  const num = (n == null || Number.isNaN(n)) ? 0 : n;
  let str = (num / 100).toLocaleString(undefined, {
    minimumFractionDigits: options.includeOre ? 2 : 0,
    maximumFractionDigits: options.includeOre ? 2 : 0
  });
  str = str.replace(/,/g, '');
  str += options.includeSymbol ? ' SEK' : '';
  return str;
}

// Parse Date Code
function parseDateCode(code) {
  const [year, week, day] = code.split('-');
  const date = moment.utc(`${year}-W${week.padStart(2, '0')}-${day}`).format();
  return {
    date,
    year: parseInt(year, 10),
    week: parseInt(week, 10),
    day: parseInt(day, 10)
  };
}

// Parse Time
function parseTime(time) {
  // Check Valid Time
  const re = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!re.test(time)) {
    return false;
  }

  const [hour, minute] = time.split(':');
  return {
    hour: parseInt(hour, 10),
    minute: parseInt(minute, 10)
  };
}

// Parse ISO Date String into date/time format, option to parse dateCode
function dateFormat(d, userOptions = {}) {
  let preferredFormat;
  switch (userOptions.format) {
    case 'short':
      preferredFormat = 'YYYY/M/D h:mm:ssa';
      break;

    case 'date':
      preferredFormat = 'D/M/YYYY';
      break;

    case 'dateFormatter':
      preferredFormat = 'YYYY-MM-DD';
      break;

    case 'time':
      preferredFormat = 'h:mm A';
      break;

    case 'long':
    default:
      preferredFormat = 'dddd Do MMMM YYYY';
      break;
  }
  if (userOptions.includeWeek === true) {
    preferredFormat += ' [(Week] w[)]';
  }
  const date = userOptions.parseCode ? parseDateCode(d).date : d;
  return moment(date)
    .tz('Europe/Stockholm')
    .format(preferredFormat);
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

// Get current week number
function getLatestWeek(deliveryDay, offset = 0) {
  if (moment().isoWeekday() <= deliveryDay) {
    return moment().add(offset, 'weeks').isoWeek();
  }
  return moment().add(1 + offset, 'weeks').isoWeek();
}

// Return readable order description
function getReadableOrder(items) {
  return items.map((item) => `${item.quantity} x ${item.name}`).join(', ');
}

// Generate a random string for cookie
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';

  for (let i = 0; i < length; i += 1) {
    str += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return str;
}

function parseMarkers(str, recipient) {
  let parsedString = str;
  const markers = {
    '%name': recipient.details.name,
    '%message': (recipient.delivery.message !== '') ? `\n${recipient.delivery.message}\n` : '',
    '%order': getReadableOrder(recipient.items)
  };
  Object.keys(markers).forEach((key) => {
    parsedString = parsedString.replace(key, markers[key]);
  });
  return parsedString;
}

module.exports = {
  priceFormat,
  dateFormat,
  parseTime,
  calculateMoms,
  calculateNetCost,
  getGoogleMapsUrl,
  getGoogleMapsDirections,
  getLatestWeek,
  parseDateCode,
  getReadableOrder,
  generateRandomString,
  parseMarkers
};
