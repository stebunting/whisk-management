// Page Tag
const tag = 'whisk-management:db-tests';

// Requirements
const assert = require('assert');
const {
  connect,
  isConnected,
  disconnect,
  getDb,
  setupDb,
  insertUser,
  getUser,
  insertTreatBoxOrder,
  getTreatBoxOrders,
  updateTreatBoxOrders,
  getTreatBoxTotals,
  removeTreatBoxOrder
} = require('../lib/db-control/db-control')(tag, 'whisk-management-test');

describe('Database Control Connection Tests', () => {
  describe('Add and retrieve user from new db', () => {
    const newUser = {
      username: 'testUser',
      firstName: 'Test',
      surname: 'User',
      password: 'bcryptedpassword',
      email: 'test@user.com'
    };

    it('is initially not connected to client', () => {
      assert.ok(!isConnected());
    });

    it('connects to client', async () => {
      await connect();
      assert.ok(isConnected());
    });

    it('retrieves correct reference to \'whisk-management-test\' db', async () => {
      const stats = await getDb().stats();
      assert.equal(stats.db, 'whisk-management-test');
    });

    it('drops database', async () => {
      const dbDropped = await getDb().dropDatabase();
      assert.ok(dbDropped);
    });

    it('sets up database with username index', async () => {
      const setupResponse = await setupDb();
      assert.equal(setupResponse, 'username_1');
      const response = await getDb().collection('users').indexInformation();
      assert.ok(response.username_1);
    });

    it('inserts single user into db', async () => {
      const insertedUser = await insertUser(newUser);
      assert.equal(insertedUser.insertedCount, 1);
      assert.deepEqual(insertedUser.ops[0], newUser);
    });

    it('fails to insert duplicate user into db', async () => {
      const duplicateUser = await insertUser(newUser);
      assert.equal(duplicateUser, null);
    });

    it('retrieves user back from db', async () => {
      const user = await getUser(newUser.username);
      // eslint-disable-next-line no-underscore-dangle
      newUser._id = user._id;
      assert.deepEqual(user, newUser);
    });

    it('returns null for unregistered user', async () => {
      const user = await getUser('thisUserIsNotInTheDb');
      assert.equal(user, null);
    });

    it('has one document in collection', async () => {
      const stats = await getDb().collection('users').stats();
      assert.equal(stats.count, 1);
    });

    it('disconnects', () => {
      disconnect();
      assert.ok(!isConnected());
    });
  });

  describe('Add new treatbox order to database', () => {
    const order = {
      itemsOrdered: {
        comboBoxes: 3,
        treatBoxes: 2,
        vegetableBoxes: 4
      },
      purchaser: {
        name: 'Dina Mystris',
        email: 'hello@whisk.se',
        telephone: '07787448962'
      },
      delivery: {
        date: '2020-25',
        type: 'split-delivery'
      },
      cost: {
        food: 740,
        delivery: 0,
        foodMoms: 79,
        deliveryMoms: 0,
        total: 740
      },
      recipients: [
        {
          itemsToDeliver: '1 x Combo Box, 1 x Vegetable Box',
          numComboBoxes: 3,
          numTreatBoxes: 2,
          numVegetableBoxes: 4,
          name: 'Stephen Bunting',
          telephone: '07754326547',
          address: 'Sandhamnsgatan 57, 115 28 Stockholm, Sweden',
          addressNotes: 'Doorcode 2288',
          zone: 1,
          message: 'Message for Ste'
        }
      ],
      payment: {
        method: 'Invoice',
        paid: false
      }
    };

    it('connects to client', async () => {
      await connect();
      assert.ok(isConnected());
    });

    it('adds order to database', async () => {
      const insertedOrder = await insertTreatBoxOrder(order);
      assert.equal(insertedOrder.insertedCount, 1);
      assert.deepEqual(insertedOrder.ops[0], order);

      assert.ok(isConnected());
    });

    it('retrieves orders from database', async () => {
      const orders = await getTreatBoxOrders();
      assert.equal(orders.length, 1);
      assert.deepEqual(orders[0], order);
    });

    it('adds second order to database', async () => {
      delete order._id;
      const insertedOrder = await insertTreatBoxOrder(order);
      assert.equal(insertedOrder.insertedCount, 1);
      assert.deepEqual(insertedOrder.ops[0], order);
    });

    it('gets total items by week', async () => {
      const response = await getTreatBoxTotals();
      assert.equal(response[0].comboBoxes, 6);
      assert.equal(response[0].treatBoxes, 4);
      assert.equal(response[0].vegetableBoxes, 8);
      assert.equal(response[0].treatBoxesToMake, 10);
      assert.equal(response[0].vegetableBoxesToOrder, 14);
      assert.equal(response[0].deliveries, 2);
      assert.equal(response[0].income, 1480);
    });

    it('updates order to paid', async () => {
      const orders = await getTreatBoxOrders();
      assert.equal(orders[1].payment.paid, false);

      const response = await updateTreatBoxOrders(orders[1]._id, { 'payment.paid': true });
      const updatedOrders = await getTreatBoxOrders();
      assert.equal(updatedOrders[1].payment.paid, true);
    });

    it('removes one item from database', async () => {
      const orders = await getTreatBoxOrders();
      assert.equal(orders.length, 2);

      const response = await removeTreatBoxOrder(orders[0]._id);
      assert.equal(response.deletedCount, 1);

      const newOrders = await getTreatBoxOrders();
      assert.equal(newOrders.length, 1);
    });

    it('disconnects', () => {
      disconnect();
      assert.ok(!isConnected());
    });
  });

  describe('Attempt to perform functions when not connected', () => {
    const newUser = {
      username: 'testUser',
      firstName: 'Test',
      surname: 'User',
      password: 'bcryptedpassword',
      email: 'test@user.com'
    };

    it('doesn\'t setup indexes on db', async () => {
      await assert.rejects(setupDb(), (error) => {
        assert.equal(error.message, 'Not connected to database');
        return true;
      });
    });

    it('doesn\'t insert single user into db', async () => {
      await assert.rejects(insertUser(newUser), (error) => {
        assert.equal(error.message, 'Not connected to database');
        return true;
      });
    });

    it('doesn\'t get user from db', async () => {
      await assert.rejects(getUser(newUser.username), (error) => {
        assert.equal(error.message, 'Not connected to database');
        return true;
      });
    });
  });
});
