// Page Tag
const tag = 'whisk-management:userController';

// Requirements
// eslint-disable-next-line no-unused-vars
const debug = require('debug')(tag);
const moment = require('moment-timezone');
const { generateRandomString, dateFormat, getLatestWeek } = require('../helpers');
const { generateFacebookUrl } = require('./socialMediaController')();
const {
  getTreatBoxDates,
  getTreatBoxTotals,
  getErrorLog,
  getSettings
} = require('../../lib/db-control')();

function userController() {
  async function dashboard(req, res) {
    // Generate Facebook State Cookie
    const state = generateRandomString(16);
    res.cookie('facebook_auth_state', state);

    // Generate Facebook Callback URL
    const facebookLoginUrl = generateFacebookUrl(state);

    const treatboxDates = await getTreatBoxDates();

    // Get Latest Treatbox Details
    // Amalgamate this into aggregation
    const timeframeSettings = await getSettings('timeframe');
    const deliveryDay = timeframeSettings.delivery.day;
    let week = getLatestWeek(deliveryDay);
    let year = moment().week(week).year();
    const dateCode1 = `${year}-${week}-3`;
    week = getLatestWeek(deliveryDay, 1);
    year = moment().week(week).year();
    const dateCode2 = `${year}-${week}-3`;
    const query = {
      'delivery.date': {
        $in: [dateCode1, dateCode2]
      }
    };
    const treatboxTotals = await getTreatBoxTotals(query);

    return res.render('dashboard', {
      user: req.user,
      facebookLoginUrl,
      treatboxDates,
      treatboxTotals,
      dateFormat
    });
  }

  async function showErrorLog(req, res) {
    const treatboxDates = await getTreatBoxDates();
    const errors = await getErrorLog();
    return res.render('errorLog', {
      user: req.user,
      treatboxDates,
      errors,
      dateFormat
    });
  }

  return {
    dashboard,
    showErrorLog
  };
}

module.exports = userController;
