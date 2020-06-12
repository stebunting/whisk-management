// Page Tag
const tag = 'whisk-management:userRoutes';

// Requirements
const express = require('express');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { getSettings, updateSettings } = require('../../lib/db-control/db-control')();

function routes() {
  const userRoutes = express.Router();

  userRoutes.use(loginCheck);
  userRoutes.route('/dashboard')
    .get((req, res) => res.render('dashboard.ejs', {
      user: req.user
    }));

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
          settings.food.comboBox.momsAmount = calculateMoms(settings.food.comboBox.price, settings.food.comboBox.momsRate);
          settings.food.treatBox.momsAmount = calculateMoms(settings.food.treatBox.price, settings.food.treatBox.momsRate);
          settings.food.vegetableBox.momsAmount = calculateMoms(settings.food.vegetableBox.price, settings.food.vegetableBox.momsRate);
          settings.delivery.zone2.momsAmount = calculateMoms(settings.delivery.zone2.price, settings.delivery.zone2.momsRate);
          updateSettings(settings);
          break;

        default:
          break;
      }

      return res.redirect('/user/settings');
    })
    .get(async (req, res) => {
      const treatboxSettings = await getSettings('treatbox');

      return res.render('settings.ejs', {
        user: req.user,
        priceFormat,
        treatboxSettings
      });
    });

  function calculateMoms(price, rate) {
    const decimalRate = 1 + (rate / 100);
    return Math.round(price * decimalRate - price);
  }

  function priceFormat(num) {
    const str = (num / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return str.replace(',', '');
  }

  return userRoutes;
}

module.exports = routes;
