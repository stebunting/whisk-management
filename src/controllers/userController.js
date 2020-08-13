// Page Tag
const tag = 'whisk-management:userController';

// Requirements
const debug = require('debug')(tag);
const { generateRandomString, dateFormat } = require('../helpers');
const { getTreatBoxDates, getErrorLog } = require('../../lib/db-control')();
const { generateFacebookUrl } = require('../controllers/socialMediaController')();

function userController() {
  async function dashboard(req, res) {
    // Generate Facebook State Cookie
    const state = generateRandomString(16);
    res.cookie('facebook_auth_state', state);

    // Generate Facebook Callback URL
    const facebookLoginUrl = generateFacebookUrl(state);

    const treatboxDates = await getTreatBoxDates();

    return res.render('dashboard', {
      user: req.user,
      facebookLoginUrl,
      treatboxDates
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
