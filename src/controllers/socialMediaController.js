// Page Tag
const tag = 'whisk-management:socialMediaController';

// Requirements
const axios = require('axios');
const querystring = require('querystring');
const debug = require('debug')(tag);
const { getUser, updateUser, logError } = require('../../lib/db-control')();

// Facebook Constants
const serverUri = 'https://whisk-management.herokuapp.com';
const appId = process.env.FACEBOOK_APP_ID;
const appSecret = process.env.FACEBOOK_APP_SECRET;
const redirectUri = `${serverUri}/user/facebookcallback`;
const scope = 'instagram_basic,pages_show_list';
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;

function socialMediaController() {
  // Generate Facebook URL
  function generateFacebookUrl(state) {
    const url = 'https://www.facebook.com/v7.0/dialog/oauth';
    const query = querystring.stringify({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope,
      response_type: 'code'
    });
    return `${url}?${query}`;
  }

  // Facebook Callback
  async function facebookCallback(req, res) {
    const { user } = req;

    // Parse returned values from Facebook
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies.facebook_auth_state : null;

    // If state does not match cookie state, then request was not made by user
    if (state === null) {
      logError({
        message: 'No State Returned from Facebook',
        details: JSON.stringify({ state, storedState }),
        data: '',
        error: ''
      });
      return res.redirect('/user/dashboard');
    }
    if (state !== storedState) {
      logError({
        message: 'Cookie State does not match state returned from Spotfy',
        details: JSON.stringify({ state, storedState }),
        data: '',
        error: ''
      });
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
  }

  async function instagram(req, res) {
    const user = await getUser('dina');

    const axiosConfig = {
      method: 'get',
      url: `https://graph.facebook.com/v7.0/${user.facebook.instagramID}/media`,
      params: {
        access_token: facebookAccessToken, // TODO: Use token from db - user.facebook.accessToken
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
  }

  return {
    generateFacebookUrl,
    facebookCallback,
    instagram
  };
}

module.exports = socialMediaController;
