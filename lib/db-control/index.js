// Page Tag
const tag = 'whisk-management:dbController';

// Requirements
const { MongoClient } = require('mongodb');
const debug = require('debug')(tag);

// MongoDB Constants
const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME;
let client;
let db;

function dbController(loggingTag) {
  // Connect to MongoDB Database
  function connect() {
    return new Promise((resolve, reject) => {
      MongoClient.connect(dbUrl, { useUnifiedTopology: true })
        .then((data) => {
          client = data;
          db = client.db(dbName);
          debug('Connected to MongoDB');
          resolve(db);
        })
        .catch((error) => {
          debug('Error connecting to MongoDB');
          reject(error);
        });
    });
  }

  // Disconnect from MongoDB Database
  function disconnect() {
    if (client != null) {
      client.close();
      debug('Disconnected from MongoDB');
    }
  }

  // Return a Database Instance
  function getDb() {
    return db;
  }

  // Setup database
  function setupDb() {
    return new Promise((resolve, reject) => {
      db.createIndex('users', 'username', { unique: true })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Get user from user collection
  function getUser(username) {
    return new Promise((resolve, reject) => {
      db.collection('users').findOne({ username })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
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
        .then((data) => {
          resolve(data.ops[0]);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  return {
    connect,
    disconnect,
    getDb,
    setupDb,
    getUser,
    logError
  };
}

module.exports = dbController;
