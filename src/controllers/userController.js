// Page Tag
const tag = 'whisk-management:userController';

// Requirements
const debug = require('debug')(tag);
const { generateRandomString } = require('../helpers');
const { getTreatBoxDates } = require('../../lib/db-control')();
const { generateFacebookUrl } = require('../controllers/socialMediaController')();

function userController() {
  async function dashboard(req, res) {
    // Generate Facebook State Cookie
    const state = generateRandomString(16);
    res.cookie('facebook_auth_state', state);

    // Generate Facebook Callback URL
    const facebookLoginUrl = generateFacebookUrl(state);

    const treatboxDates = await getTreatBoxDates();

    return res.render('dashboard.ejs', {
      user: req.user,
      facebookLoginUrl,
      treatboxDates
    });
  }

  return {
    dashboard
  };
}

module.exports = userController;
