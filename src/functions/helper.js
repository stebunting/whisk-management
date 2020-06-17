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

module.exports = {
  priceFormat,
  getGoogleMapsUrl,
  getFormattedDeliveryDate,
  getReadableOrder
};
