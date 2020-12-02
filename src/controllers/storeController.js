// Page Tag
const tag = 'whisk-management:storeController';

// Requirements
const debug = require('debug')(tag);
const { getTreatBoxDates, getStoreOrders } = require('../../lib/db-control')();
const { dateFormat } = require('../helpers');

function storeController() {
  // Display Treatbox Orders Page
  async function storeOrdersPage(req, res) {
    const treatboxDates = await getTreatBoxDates();
    const orders = await getStoreOrders();

    return res.render('storeOrders', {
      user: req.user,
      treatboxDates,
      orders,
      dateFormat
    });
  }

  return {
    storeOrdersPage
  };
}

module.exports = storeController;
