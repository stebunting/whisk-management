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
        .then(() => db.createIndex('rebateCodes', 'code', {
          unique: true,
          name: 'code_1'
        }))
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

  function addRebateCode(code) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('rebateCodes').insert(code)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function updateRebateCode(id, query) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('rebateCodes').updateOne(
        { _id: ObjectID(id) },
        query
      )
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function removeRebateCode(id) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('rebateCodes').removeOne({ _id: ObjectID(id) })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getRebateCodes(query) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('rebateCodes')
        .find(query)
        .sort({ expires: 1, _id: 1 })
        .toArray()
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
        $unwind: {
          path: '$recipients',
          includeArrayIndex: 'recipients.index',
          preserveNullAndEmptyArrays: true
        }
      }, {
        $project: {
          details: 1,
          delivery: 1,
          statement: 1,
          payment: 1,
          refunded: { $sum: { $ifNull: ['$payment.swish.refunds.amount', 0] } },
          recipient: '$recipients',
          order: {
            $cond: {
              if: { $eq: ['$payment.status', 'Cancelled'] },
              then: -100,
              else: {
                $cond: {
                  if: { $eq: ['$delivery.type', 'collection'] },
                  then: -50,
                  else: '$recipients.delivery.order'
                }
              }
            }
          }
        }
      }, {
        $sort: {
          'delivery.date': 1,
          order: 1
        }
      }]).toArray()
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

  function recordSwishRefund(id, refundData) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders')
        .updateOne({ _id: ObjectID(id) }, { $push: { 'payment.swish.refunds': refundData } })
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function updateSwishRefundStatus(refundId, refundStatus) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders')
        .updateOne(
          { 'payment.swish.refunds.id': refundId },
          { $set: { 'payment.swish.refunds.$.status': refundStatus } }
        )
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
          highestOrder: { $max: '$recipients.delivery.order' }
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
        $unwind: {
          path: '$statement.products',
          includeArrayIndex: 'index'
        }
      }, {
        $project: {
          _id: false,
          delivery: 1,
          products: {
            name: '$statement.products.name',
            quantity: '$statement.products.quantity'
          },
          bottomLine: {
            $cond: {
              if: { $ne: [0, '$index'] },
              then: '$$REMOVE',
              else: '$statement.bottomLine'
            }
          },
          recipients: {
            $cond: {
              if: { $ne: [0, '$index'] },
              then: '$$REMOVE',
              else: '$recipients.details'
            }
          },
          collection: {
            $cond: {
              if: { $eq: ['collection', '$delivery.type'] },
              then: 1,
              else: 0
            }
          }
        }
      }, {
        $group: {
          _id: {
            date: '$delivery.date',
            name: '$products.name'
          },
          quantity: {
            $sum: '$products.quantity'
          },
          income: {
            $sum: '$bottomLine.total'
          },
          deliveries: { $sum: { $size: { $ifNull: ['$recipients', []] } } },
          collection: { $sum: '$collection' }
        }
      }, {
        $group: {
          _id: '$_id.date',
          items: {
            $addToSet: {
              name: '$_id.name',
              quantity: '$quantity',
            }
          },
          income: { $sum: '$income' },
          deliveries: { $sum: '$deliveries' },
          collections: { $sum: '$collection' }
        }
      }, {
        $sort: {
          _id: 1
        }
      }]).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getTreatBoxDates() {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('treatboxOrders').aggregate([{
        $group: {
          _id: '$delivery.date'
        }
      }, {
        $sort: {
          _id: -1
        }
      }]).toArray()
        .then((response) => {
          const dates = [];
          response.forEach((date) => {
            const [year, week, day] = date._id.split('-');
            dates.push({
              year,
              week,
              link: date._id
            });
          });
          return resolve(dates);
        })
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

  function updateProduct(id, product) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('products').updateOne(
        { _id: ObjectID(id) },
        { $set: { ...product } }
      )
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function removeProduct(id) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('products').removeOne({ _id: ObjectID(id) })
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

  function addBoxLoan(details) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('boxes').insertOne(details)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getBoxLoans(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('boxes').find(query).sort({ _id: -1 }).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function getBoxLoanById(id) {
    return new Promise((resolve, reject) => {
      getBoxLoans({ _id: ObjectID(id) })
        .then((data) => resolve(data[0]))
        .catch((error) => reject(error));
    });
  }

  function updateBoxLoan(id, query) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('boxes').updateOne(
        { _id: ObjectID(id) },
        query
      )
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Store Functions
  function getStoreOrders(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('storeOrders').find(query).sort({ _id: -1 }).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  // Log error
  // Expect Message, Details, Error
  function logError(doc) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      const {
        message,
        details,
        data,
        error
      } = doc;
      return db.collection('errorLog').insertOne({
        message, details, data, error
      })
        .then((response) => resolve(response.ops[0]))
        .catch((err) => reject(err));
    });
  }

  function getErrorLog(query = {}) {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('errorLog').find(query).sort({ _id: -1 }).toArray()
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  }

  function clearErrorLog() {
    return new Promise((resolve, reject) => {
      if (!isConnected()) {
        return reject(new Error('Not connected to database'));
      }
      return db.collection('errorLog').removeMany({})
        .then((data) => resolve(data))
        .catch((error) => reject(error));
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
    addRebateCode,
    updateRebateCode,
    removeRebateCode,
    getRebateCodes,
    insertTreatBoxOrder,
    getTreatBoxOrders,
    getTreatBoxOrderById,
    getRecipients,
    updateTreatBoxOrders,
    recordSwishRefund,
    updateSwishRefundStatus,
    getHighestOrder,
    getTreatBoxTotals,
    getTreatBoxDates,
    removeTreatBoxOrder,
    addProduct,
    updateProduct,
    removeProduct,
    getProducts,
    getProductById,
    addBoxLoan,
    getBoxLoans,
    getBoxLoanById,
    updateBoxLoan,
    getStoreOrders,
    logError,
    getErrorLog,
    clearErrorLog
  };
}

module.exports = dbController;
