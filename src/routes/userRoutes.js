// Page Tag
const tag = 'whisk-management:userRoutes';

// Requirements
const express = require('express');
const querystring = require('querystring');
const axios = require('axios');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { priceFormat, calculateMoms, generateRandomString } = require('../functions/helper');
const {
  getUser,
  updateUser,
  getSettings,
  updateSettings
} = require('../../lib/db-control/db-control')();

// Facebook Constants
const serverUri = 'https://whisk-management.herokuapp.com';
const appId = process.env.FACEBOOK_APP_ID;
const appSecret = process.env.FACEBOOK_APP_SECRET;
const redirectUri = `${serverUri}/user/facebookcallback`;
const scope = 'instagram_basic,pages_show_list';

function routes() {
  const userRoutes = express.Router();

  userRoutes.route('/dashboard')
    .all(loginCheck)
    .get((req, res) => {
      // Generate State Cookie
      const state = generateRandomString(16);
      res.cookie('facebook_auth_state', state);

      // Generate Facebook Callback URL
      const url = 'https://www.facebook.com/v7.0/dialog/oauth';
      const query = querystring.stringify({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        scope,
        response_type: 'code'
      });
      const facebookLoginUrl = `${url}?${query}`;

      return res.render('dashboard.ejs', {
        user: req.user,
        facebookLoginUrl
      });
    });

  userRoutes.route('/facebookcallback')
    .get(async (req, res) => {
      const { user } = req;

      // Parse returned values from Facebook
      const code = req.query.code || null;
      const state = req.query.state || null;
      const storedState = req.cookies ? req.cookies.facebook_auth_state : null;

      // If state does not match cookie state, then request was not made by user
      if (state === null) {
        // logError('No State Returned from Spotify');
        return res.redirect('/user/dashboard');
      }
      if (state !== storedState) {
        // logError('Cookie State does not match state returned from Spotfy');
        return res.redirect('/user/dashboard');
      }
      res.clearCookie('facebook_auth_state');

      // Get Facebook Access Token
      const axiosConfig = {
        method: 'get',
        url: 'https://graph.facebook.com/v7.0/oauth/access_token',
        params: {
          client_id: appId,
          redirect_uri: redirectUri,
          client_secret: appSecret,
          code
        }
      };
      let response = await axios(axiosConfig);
      user.facebook = {
        accessToken: response.data.access_token
      };

      // Get Facebook Page ID
      axiosConfig.url = 'https://graph.facebook.com/v7.0/me/accounts';
      axiosConfig.params = {
        access_token: user.facebook.accessToken
      };
      response = await axios(axiosConfig);
      user.facebook.facebookID = response.data.data[0].id;

      // Get Instagam Business Account
      axiosConfig.url = `https://graph.facebook.com/v7.0/${user.facebook.facebookID}`;
      axiosConfig.params.fields = 'instagram_business_account';
      response = await axios(axiosConfig);
      user.facebook.instagramID = response.data.instagram_business_account.id;

      updateUser(user);

      return res.redirect('/user/dashboard');
    });

  userRoutes.route('/instagram')
    .get(async (req, res) => {
      const user = await getUser('dina-offline');

      const axiosConfig = {
        method: 'get',
        url: `https://graph.facebook.com/v7.0/${user.facebook.instagramID}/media`,
        params: {
          access_token: user.facebook.accessToken
        }
      };
      const allMedia = await axios(axiosConfig);

      const instagramData = [];
      const imagesToGet = 6;
      axiosConfig.params.fields = 'permalink,media_url,caption';
      const promises = [];
      for (let i = 0; i < imagesToGet; i += 1) {
        axiosConfig.url = `https://graph.facebook.com/v7.0/${allMedia.data.data[i].id}`;
        promises.push(axios(axiosConfig));
      }
      await Promise.allSettled(promises)
        .then((data) => {
          for (let i = 0; i < data.length; i += 1) {
            if (data[i].status === 'fulfilled') {
              instagramData.push(data[i].value.data);
            }
          }
        });
      return res.json(instagramData);
    });

  userRoutes.route('/settings')
    .post((req, res) => {
      const { submit } = req.body;

      let settings;
      switch (submit) {
        case 'treatboxUpdate':
          settings = {
            type: 'treatbox',
            food: {
              comboBox: {
                price: parseInt(req.body['combobox-price'], 10) * 100,
                momsRate: 12
              },
              treatBox: {
                price: parseInt(req.body['treatbox-price'], 10) * 100,
                momsRate: 12
              },
              vegetableBox: {
                price: parseInt(req.body['vegetablebox-price'], 10) * 100,
                momsRate: 12
              }
            },
            delivery: {
              zone2: {
                price: parseInt(req.body['zone2-delivery-price'], 10) * 100,
                momsRate: 25
              }
            }
          };
          settings.food.comboBox.momsAmount = calculateMoms(
            settings.food.comboBox.price,
            settings.food.comboBox.momsRate
          );
          settings.food.treatBox.momsAmount = calculateMoms(
            settings.food.treatBox.price,
            settings.food.treatBox.momsRate
          );
          settings.food.vegetableBox.momsAmount = calculateMoms(
            settings.food.vegetableBox.price,
            settings.food.vegetableBox.momsRate
          );
          settings.delivery.zone2.momsAmount = calculateMoms(
            settings.delivery.zone2.price,
            settings.delivery.zone2.momsRate
          );
          updateSettings(settings);
          break;

        case 'rebatecodesUpdate':
          const codesToGet = (Object.keys(req.body).length - 1) / 2;
          const codes = [];
          for (let i = 0; i < codesToGet; i += 1) {
            const code = {
              value: req.body[`rebate-code-${i}`],
              type: req.body[`rebate-type-${i}`]
            };
            if (code.value !== '') {
              codes.push(code);
            }
          }
          settings = {
            type: 'rebatecodes',
            codes
          };
          updateSettings(settings);
          break;

        default:
          break;
      }

      return res.redirect('/user/settings');
    })
    .get(async (req, res) => {
      const treatboxSettings = await getSettings('treatbox');
      const rebatecodeSettings = await getSettings('rebatecodes');

      return res.render('settings.ejs', {
        user: req.user,
        priceFormat,
        treatboxSettings,
        rebatecodeSettings
      });
    });

  return userRoutes;
}

module.exports = routes;
