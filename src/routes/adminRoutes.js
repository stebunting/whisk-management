// Page Tag
const tag = 'whisk-management:adminRoutes';

// Requirements
const express = require('express');
const { ObjectID } = require('mongodb');
const debug = require('debug')(tag);
const { loginCheck } = require('../controllers/authController')();
const { setupDb, getDb } = require('../../lib/db-control')(tag);

function routes() {
  const adminRoutes = express.Router();

  adminRoutes.use(loginCheck);
  adminRoutes.route('/setupdb')
    .get(async (req, res) => {
      try {
        await setupDb();
        return res.send('Database Setup Complete');
      } catch (error) {
        debug(error);
        return res.send(error.stack);
      }
    });

  adminRoutes.route('/convertDB')
    .get(async (req, res) => {
      const db = getDb();
      const orders = await db.collection('treatboxOrders')
        .find({}, { projection: { 'statement.delivery': 1 } })
        .toArray();
      orders.forEach(async (order) => {
        if (Object.keys(order.statement.delivery).length === 0) {
          order.statement.delivery = [];
        }
        if (order.statement.delivery.zone1) {
          order.statement.delivery.zone1.zone = 1;
        }
        if (order.statement.delivery.zone2) {
          order.statement.delivery.zone2.zone = 2;
        }
        if (order.statement.delivery.zone3) {
          order.statement.delivery.zone3.zone = 3;
        }
        if (Object.keys(order.statement.delivery).length > 0) {
          const newDeliveries = [];
          Object.keys(order.statement.delivery).forEach((o) => {
            newDeliveries.push(order.statement.delivery[o]);
          });
          order.statement.delivery = newDeliveries;
        }
        await db.collection('treatboxOrders').updateOne(
          { _id: ObjectID(order._id) },
          { $set: { 'statement.delivery': order.statement.delivery } }
        );
      });
      const newOrders = await db.collection('treatboxOrders')
        .find({}, { projection: { 'statement.delivery': 1 } })
        .toArray();
      return res.json(newOrders);
    });

  return adminRoutes;
}

module.exports = routes;
