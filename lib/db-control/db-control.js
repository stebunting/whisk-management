// Page Tag
const tag = 'whisk-management:db-control';

// Requirements
require('dotenv').config();
const { MongoClient, ObjectID } = require('mongodb');
const debug = require('debug')(tag);

const dbUrl = process.env.DB_URL;
let client;
let db;

function dbController(loggingTag, dbName = process.env.DB_NAME) {
  // Connect to MongoDB Database
  function connect() {
    return new Promise((resolve, reject) => {
      MongoClient.connect(dbUrl, { useUnifiedTopology: true })
        .then((data) => {
          client = data;
          db = client.db(dbName);
          debug('Connected to MongoDB');
          return resolve(db);
        })
        .catch((error) => {
          debug('Error connecting to MongoDB');
          return reject(error);
        });
    });
  }

  // Disconnect from MongoDB Database
  function disconnect() {
    if (client != null) {
      client.close();
      client = undefined;
      db = undefined;
      debug('Disconnected from MongoDB');
    }
  }

  // Return true or false if database is connected or not
  function isConnected() {
    if (client === undefined) {
      return false;
    }
    return client.isConnected();
  }

  // Return a Database Instance
  function getDb() {
    return db;
  }

  // Setup database
  function setupDb() {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.createIndex('users', 'username', {
        unique: true,
        name: 'username_1'
      })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Insert user into user collection
  function insertUser(user) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('users').insertOne(user)
        .then((data) => resolve(data))
        .catch((error) => {
          if (error.code === 11000) {
            return resolve(null);
          }
          return reject(error);
        });
    });
  }

  function updateUser(user) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('users').updateOne(
        { username: user.username },
        { $set: user }
      )
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Get user from user collection
  function getUser(username) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('users').findOne({ username })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getSettings(settingsType) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('settings').findOne({ type: settingsType })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function updateSettings(settings) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('settings').updateOne(
        { type: settings.type },
        { $set: settings },
        { upsert: true }
      )
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Add new treatbox order to the database
  function insertTreatBoxOrder(order) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').insertOne(order)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Get orders from treatbox orders collection
  function getTreatBoxOrders(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders')
        .find(query)
        .sort({ 'delivery.date': 1, _id: 1 })
        .toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getTreatBoxOrderById(id) {
    return new Promise((resolve, reject) => {
      getTreatBoxOrders({ _id: ObjectID(id) })
        .then((data) => resolve(data[0]))
        .catch((error) => reject(error));
    });
  }

  function getRecipients(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').aggregate([{
        $match: query
      }, {
        $project: {
          items: 1,
          details: 1,
          delivery: 1,
          recipient: '$recipients',
          cost: 1,
          payment: 1
        }
      }, {
        $unwind: {
          path: '$recipient',
          includeArrayIndex: 'recipient.index',
          preserveNullAndEmptyArrays: true
        }
      }
      ]).sort({ 'delivery.date': 1, 'recipient.delivery.order': 1 })
        .toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Get orders from treatbox orders collection
  function updateTreatBoxOrders(id, updatedData) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders')
        .updateOne({ _id: ObjectID(id) }, { $set: updatedData })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getHighestOrder() {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').aggregate([{
        $match:
          { 'delivery.type': { $ne: 'collection' } }
      }, {
        $unwind: '$recipients'
      }, {
        $group: {
          _id: null,
          highestOrder: { $max: { $ifNull: ['$recipients.delivery.order', 0] } }
        }
      }]).toArray()
        .then((data) => resolve(data[0]))
        .catch((error) => reject(error));
    });
  }

  // Get totals from treatbox orders collection
  function getTreatBoxTotals(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').aggregate([{
        $match: {
          $and: [
            query,
            { 'payment.status': { $ne: 'Cancelled' } }
          ]
        }
      }, {
        $group: {
          _id: '$delivery.date',
          comboBoxes: { $sum: '$items.comboBoxes' },
          treatBoxes: { $sum: '$items.treatBoxes' },
          vegetableBoxes: { $sum: '$items.vegetableBoxes' },
          treatBoxesToMake: {
            $sum: {
              $add: ['$items.treatBoxes', '$items.comboBoxes']
            }
          },
          vegetableBoxesToOrder: {
            $sum: {
              $add: ['$items.vegetableBoxes', '$items.comboBoxes']
            }
          },
          deliveries: { $sum: { $size: { $ifNull: ['$recipients', []] } } },
          income: { $sum: '$cost.total' },
        }
      }]).sort({ _id: 1 }).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function removeTreatBoxOrder(id) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').removeOne({ _id: ObjectID(id) })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Add New Product
  function addProduct(product) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('products').insertOne(product)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getProducts(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('products').find(query).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getProductById(id) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return getProducts({ _id: ObjectID(id) })
        .then((data) => resolve(data[0]))
        .catch((error) => reject(error));
    });
  }

  // Log error
  async function logError(message, error) {
    return new Promise((resolve, reject) => {
      db.collection('errorLog').insertOne({
        tag: loggingTag,
        message,
        error: error.stack
      })
        .then((data) => resolve(data.ops[0]))
        .catch((err) => reject(err));
    });
  }

  return {
    connect,
    isConnected,
    disconnect,
    getDb,
    setupDb,
    insertUser,
    updateUser,
    getUser,
    getSettings,
    updateSettings,
    insertTreatBoxOrder,
    getTreatBoxOrders,
    getTreatBoxOrderById,
    getRecipients,
    updateTreatBoxOrders,
    getHighestOrder,
    getTreatBoxTotals,
    removeTreatBoxOrder,
    addProduct,
    getProducts,
    getProductById,
    logError
  };
}

module.exports = dbController;
