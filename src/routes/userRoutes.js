// Page Tag
const tag = 'whisk-management:userRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { updateSettings, displaySettings } = require('../controllers/settingsController')();
const { facebookCallback, instagram } = require('../controllers/socialMediaController')();
const { dashboard } = require('../controllers/userController')();

function routes() {
  const userRoutes = express.Router();

  userRoutes.route('/dashboard')
    .all(loginCheck)
    .get(dashboard);

  userRoutes.route('/settings')
    .post(updateSettings)
    .get(displaySettings);

  userRoutes.route('/facebookcallback')
    .get(facebookCallback);

  userRoutes.route('/instagram')
    .get(instagram);

  return userRoutes;
}

module.exports = routes;
