/* eslint-disable no-underscore-dangle */
// Page Tag
const tag = 'whisk-management:treatbox-tests';

// Requirements
const assert = require('assert').strict;
const {
  connect,
  isConnected,
  getDb,
  disconnect,
  addProduct,
  getProducts,
  updateSettings
} = require('../lib/db-control')(tag, 'whisk-management-test');
const { apiLookupPrice, calculatePrice } = require('../src/controllers/treatBoxController')();
const { test } = require('./test-data');

describe.only('Treatbox Tests', () => {
  let req;
  let res;
  let products = [];

  describe('Treatbox', () => {
    before('setup db', async () => {
      // Connect to DB
      await connect();
      assert.ok(isConnected());
      await getDb().dropDatabase();

      // Add Treat Box Product
      let response = await addProduct(test.products.treatBox);
      assert.equal(response.insertedCount, 1);
      assert.deepEqual(response.ops[0], test.products.treatBox);

      // Add Vegetable Box Product
      response = await addProduct(test.products.vegetableBox);
      assert.equal(response.insertedCount, 1);
      assert.deepEqual(response.ops[0], test.products.vegetableBox);

      // Get Products
      products = await getProducts();
      assert.equal(products.length, 2);

      // Add Rebate Code
      response = await updateSettings(test.settings.rebateCodes);
      assert.equal(response.upsertedCount, 1);
    });

    beforeEach('mock request/response', () => {
      req = {
        body: {}
      };
      res = {
        json(x) {
          return x;
        }
      };
    });

    after('disconnect from db', () => {
      disconnect();
      assert.ok(!isConnected());
    });

    it('looks up price with empty basket', async () => {
      req.body = {
        basket: [],
        recipients: [],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [],
        delivery: [],
        bottomLine: {
          foodCost: 0,
          deliveryCost: 0,
          foodMoms: 0,
          deliveryMoms: 0,
          totalMoms: 0,
          total: 0
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('looks up price with one product', async () => {
      req.body = {
        basket: [{
          id: products[0]._id,
          quantity: 1
        }],
        recipients: [],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: req.body.basket[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice,
          momsSubTotal: test.products.treatBox.momsAmount
        }],
        delivery: [],
        bottomLine: {
          foodCost: test.products.treatBox.grossPrice,
          deliveryCost: 0,
          foodMoms: test.products.treatBox.momsAmount,
          deliveryMoms: 0,
          totalMoms: test.products.treatBox.momsAmount,
          total: test.products.treatBox.grossPrice
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('looks up price with 2 products', async () => {
      req.body = {
        basket: [{
          id: products[1]._id,
          quantity: 2
        }],
        recipients: [],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [{
          id: products[1]._id,
          name: test.products.vegetableBox.name,
          quantity: req.body.basket[0].quantity,
          price: test.products.vegetableBox.grossPrice,
          momsAmount: test.products.vegetableBox.momsAmount,
          momsRate: test.products.vegetableBox.momsRate,
          subTotal: test.products.vegetableBox.grossPrice * 2,
          momsSubTotal: test.products.vegetableBox.momsAmount * 2
        }],
        delivery: [],
        bottomLine: {
          foodCost: test.products.vegetableBox.grossPrice * 2,
          deliveryCost: 0,
          foodMoms: test.products.vegetableBox.momsAmount * 2,
          deliveryMoms: 0,
          totalMoms: test.products.vegetableBox.momsAmount * 2,
          total: test.products.vegetableBox.grossPrice * 2
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('looks up price with 2 different products and quantites', async () => {
      req.body = {
        basket: [{
          id: products[0]._id,
          quantity: 1
        }, {
          id: products[1]._id,
          quantity: 3
        }],
        recipients: [],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: req.body.basket[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice,
          momsSubTotal: test.products.treatBox.momsAmount
        }, {
          id: products[1]._id,
          name: test.products.vegetableBox.name,
          quantity: 3,
          price: test.products.vegetableBox.grossPrice,
          momsAmount: test.products.vegetableBox.momsAmount,
          momsRate: test.products.vegetableBox.momsRate,
          subTotal: test.products.vegetableBox.grossPrice * 3,
          momsSubTotal: test.products.vegetableBox.momsAmount * 3
        }],
        delivery: [],
        bottomLine: {
          foodCost: test.products.vegetableBox.grossPrice * 3 + test.products.treatBox.grossPrice,
          deliveryCost: 0,
          foodMoms: test.products.vegetableBox.momsAmount * 3 + test.products.treatBox.momsAmount,
          deliveryMoms: 0,
          totalMoms: test.products.vegetableBox.momsAmount * 3 + test.products.treatBox.momsAmount,
          total: test.products.vegetableBox.grossPrice * 3 + test.products.treatBox.grossPrice
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('looks up price with one product and one delivery recipient', async () => {
      req.body = {
        basket: [{
          id: products[0]._id,
          quantity: 1
        }],
        recipients: [{
          id: null,
          zone: 2,
          products: [{
            id: products[0]._id,
            quantity: 1
          }]
        }],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: req.body.basket[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice,
          momsSubTotal: test.products.treatBox.momsAmount
        }],
        delivery: [{
          recipientId: null,
          zone: 2,
          price: test.products.treatBox.delivery[2].price,
          momsRate: 25,
          momsAmount: 1000,
        }],
        bottomLine: {
          foodCost: test.products.treatBox.grossPrice,
          deliveryCost: test.products.treatBox.delivery[2].price,
          foodMoms: test.products.treatBox.momsAmount,
          deliveryMoms: 1000,
          totalMoms: test.products.treatBox.momsAmount + 1000,
          total: test.products.treatBox.grossPrice + test.products.treatBox.delivery[2].price
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('looks up price with one product and two delivery recipients', async () => {
      req.body = {
        basket: [{
          id: products[0]._id,
          quantity: 2
        }],
        recipients: [{
          id: 1,
          zone: 2,
          products: [{
            id: products[0]._id,
            quantity: 1
          }]
        }, {
          id: 2,
          zone: 1,
          products: [{
            id: products[0]._id,
            quantity: 1
          }]
        }],
        codes: []
      };
      const expectedResponse = {
        status: 'OK',
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: req.body.basket[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice * 2,
          momsSubTotal: test.products.treatBox.momsAmount * 2
        }],
        delivery: [{
          recipientId: 1,
          zone: 2,
          price: test.products.treatBox.delivery[2].price,
          momsRate: 25,
          momsAmount: 1000,
        }, {
          recipientId: 2,
          zone: 1,
          price: test.products.treatBox.delivery[1].price,
          momsRate: 25,
          momsAmount: 0,
        }],
        bottomLine: {
          foodCost: test.products.treatBox.grossPrice * 2,
          deliveryCost: test.products.treatBox.delivery[2].price,
          foodMoms: test.products.treatBox.momsAmount * 2,
          deliveryMoms: 1000,
          totalMoms: test.products.treatBox.momsAmount * 2 + 1000,
          total: test.products.treatBox.grossPrice * 2 + test.products.treatBox.delivery[2].price
        }
      };
      const response = await apiLookupPrice(req, res);
      assert.deepEqual(response, expectedResponse);
    });

    it('calculates price from order object', async () => {
      const order = test.orders.twoRecipients;
      order.items = [{
        id: products[0]._id.toString(),
        quantity: 3,
        name: products[0].name
      }, {
        id: products[1]._id.toString(),
        quantity: 1,
        name: products[1].name
      }];

      order.recipients[0].items = [{
        id: products[0]._id.toString(),
        quantity: 1,
        name: products[0].name
      }];

      order.recipients[1].items = [{
        id: products[0]._id.toString(),
        quantity: 2,
        name: products[0].name
      }, {
        id: products[1]._id.toString(),
        quantity: 1,
        name: products[1].name
      }];

      const expectedResponse = {
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: order.items[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice * 3,
          momsSubTotal: test.products.treatBox.momsAmount * 3
        }, {
          id: products[1]._id,
          name: test.products.vegetableBox.name,
          quantity: order.items[1].quantity,
          price: test.products.vegetableBox.grossPrice,
          momsAmount: test.products.vegetableBox.momsAmount,
          momsRate: test.products.vegetableBox.momsRate,
          subTotal: test.products.vegetableBox.grossPrice,
          momsSubTotal: test.products.vegetableBox.momsAmount
        }],
        delivery: [{
          recipientId: 0,
          zone: 1,
          price: test.products.treatBox.delivery[1].price,
          momsRate: 25,
          momsAmount: 0,
        }, {
          recipientId: 1,
          zone: 3,
          price: test.products.treatBox.delivery[2].price,
          momsRate: 25,
          momsAmount: 1000,
        }],
        bottomLine: {
          foodCost: test.products.treatBox.grossPrice * 3 + test.products.vegetableBox.grossPrice,
          deliveryCost: test.products.treatBox.delivery[2].price,
          foodMoms: test.products.treatBox.momsAmount * 3 + test.products.vegetableBox.momsAmount,
          deliveryMoms: 1000,
          totalMoms: test.products.treatBox.momsAmount * 3
                   + test.products.vegetableBox.momsAmount
                   + 1000,
          total: test.products.treatBox.grossPrice * 3
               + test.products.vegetableBox.grossPrice
               + test.products.treatBox.delivery[2].price
        }
      };
      const response = await calculatePrice(order);
      assert.deepEqual(response, expectedResponse);
    });

    it('calculates price from order collection object', async () => {
      const order = test.orders.collection;
      order.items = [{
        id: products[0]._id.toString(),
        quantity: 3,
        name: products[0].name
      }, {
        id: products[1]._id.toString(),
        quantity: 1,
        name: products[1].name
      }];

      const expectedResponse = {
        products: [{
          id: products[0]._id,
          name: test.products.treatBox.name,
          quantity: order.items[0].quantity,
          price: test.products.treatBox.grossPrice,
          momsAmount: test.products.treatBox.momsAmount,
          momsRate: test.products.treatBox.momsRate,
          subTotal: test.products.treatBox.grossPrice * 3,
          momsSubTotal: test.products.treatBox.momsAmount * 3
        }, {
          id: products[1]._id,
          name: test.products.vegetableBox.name,
          quantity: order.items[1].quantity,
          price: test.products.vegetableBox.grossPrice,
          momsAmount: test.products.vegetableBox.momsAmount,
          momsRate: test.products.vegetableBox.momsRate,
          subTotal: test.products.vegetableBox.grossPrice,
          momsSubTotal: test.products.vegetableBox.momsAmount
        }],
        delivery: [],
        bottomLine: {
          foodCost: test.products.treatBox.grossPrice * 3 + test.products.vegetableBox.grossPrice,
          deliveryCost: 0,
          foodMoms: test.products.treatBox.momsAmount * 3 + test.products.vegetableBox.momsAmount,
          deliveryMoms: 0,
          totalMoms: test.products.treatBox.momsAmount * 3
                   + test.products.vegetableBox.momsAmount,
          total: test.products.treatBox.grossPrice * 3
               + test.products.vegetableBox.grossPrice
        }
      };
      const response = await calculatePrice(order);
      assert.deepEqual(response, expectedResponse);
    });
  });
});
