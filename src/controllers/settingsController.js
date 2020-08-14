// Page Tag
const tag = 'whisk-management:settingsController';

// Requirements
const bcrypt = require('bcrypt');
const debug = require('debug')(tag);
const {
  priceFormat,
  calculateMoms,
  calculateNetCost
} = require('../helpers');
const {
  getTreatBoxDates,
  updateUser,
  addProduct,
  getSettings,
  updateSettings: dbUpdateSettings,
  getProducts
} = require('../../lib/db-control')();

function settingsController() {
  // Function to Update Settings in Database
  async function updateSettings(req, res) {
    const { submit } = req.body;

    switch (submit) {
      case 'add-product': {
        const product = {
          name: req.body['add-product-name'],
          description: req.body['add-product-description'],
          grossPrice: parseInt(req.body['add-product-price'], 10) * 100,
          costPrice: parseInt(req.body['add-product-cost-price'], 10) * 100,
          momsRate: parseInt(req.body['add-product-moms'], 10),
          deliverableZone: parseInt(req.body['add-product-deliverable'], 10),
          deadline: req.body['add-product-deadline']
        };
        product.momsAmount = calculateMoms(product.grossPrice, product.momsRate);
        product.netPrice = calculateNetCost(product.grossPrice, product.momsRate);
        addProduct(product);
        break;
      }

      case 'timeframe-update': {
        const settings = {
          type: 'timeframe',
          delivery: {
            day: parseInt(req.body['timeframe-delivery-date'], 10),
            time: req.body['timeframe-delivery-time']
          },
          deadline: [{
            type: 'normal',
            day: parseInt(req.body['timeframe-deadline-date'], 10),
            time: req.body['timeframe-deadline-time']
          }, {
            type: 'vegetable',
            day: parseInt(req.body['timeframe-vegetable-deadline-date'], 10),
            time: req.body['timeframe-vegetable-deadline-time']
          }]
        };
        debug(settings);
        dbUpdateSettings(settings);
        break;
      }

      case 'treatboxUpdate': {
        const settings = {
          type: 'treatbox',
          delivery: []
        };
        for (let i = 0; i <= 3; i += 1) {
          const zone = {
            zone: i,
            price: parseInt(req.body[`zone${i}-delivery-price`], 10) * 100,
            momsRate: 25
          };
          zone.momsAmount = calculateMoms(zone.price, zone.momsRate);
          settings.delivery.push(zone);
        }
        dbUpdateSettings(settings);
        break;
      }

      case 'rebatecodesUpdate': {
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
        const settings = {
          type: 'rebatecodes',
          codes
        };
        dbUpdateSettings(settings);
        break;
      }

      case 'smsUpdate': {
        const settings = {
          type: 'sms',
          defaultDelivery: req.body['default-sms']
        };
        dbUpdateSettings(settings);
        break;
      }

      case 'update-user-details': {
        if (req.body.email === '') {
          req.flash('danger', 'E-mail can not be empty');
          break;
        }
        req.user.email = req.body.email;

        try {
          await updateUser(req.user);
          req.flash('success', 'Details Updated!');
        } catch (error) {
          req.flash('danger', error);
        }
        break;
      }

      case 'update-password': {
        if (!await bcrypt.compare(req.body['old-password'], req.user.password)) {
          req.flash('danger', 'Old Password Incorrect!');
          break;
        }
        if (!(req.body['new-password'] === req.body['confirm-new-password'])) {
          req.flash('danger', 'New Password must match Confirmed New Password');
          break;
        }

        req.user.password = await bcrypt.hash(req.body['new-password'], 10);
        try {
          await updateUser(req.user);
          req.flash('success', 'Password Updated!');
        } catch (error) {
          req.flash('danger', error);
        }
        break;
      }

      default:
        break;
    }

    return res.redirect('/user/settings');
  }

  // Function to Render Settings Page
  async function displaySettings(req, res) {
    const promises = [
      getProducts(),
      getSettings('treatbox'),
      getSettings('rebatecodes'),
      getSettings('sms'),
      getTreatBoxDates(),
      getSettings('timeframe')
    ];
    const data = await Promise.allSettled(promises);
    const products = data[0].value;
    const treatboxSettings = data[1].value;
    const rebatecodeSettings = data[2].value;
    const smsSettings = data[3].value;
    const treatboxDates = data[4].value;
    const timeframeSettings = data[5].value;

    return res.render('settings.ejs', {
      user: req.user,
      products,
      priceFormat,
      treatboxSettings,
      rebatecodeSettings,
      smsSettings,
      treatboxDates,
      timeframeSettings
    });
  }

  return { updateSettings, displaySettings };
}

module.exports = settingsController;
