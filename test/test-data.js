module.exports.test = {
  products: {},
  orders: {},
  settings: {}
};

module.exports.test.products.treatBox = {
  name: 'Treat Box',
  grossPrice: 11200,
  momsRate: 12,
  momsAmount: 1200,
  netPrice: 10000,
  costPrice: 5000,
  deadline: 'normal',
  description: 'Description',
  delivery: [{
    zone: 0,
    deliverable: true,
    price: 0
  }, {
    zone: 1,
    deliverable: true,
    price: 0
  }, {
    zone: 2,
    deliverable: true,
    price: 5000
  }, {
    zone: 3,
    deliverable: false,
    price: 10000
  }]
};

module.exports.test.products.vegetableBox = {
  name: 'Vegetable Box',
  grossPrice: 25000,
  momsRate: 25,
  momsAmount: 5000,
  netPrice: 20000,
  costPrice: 10000,
  description: 'Description',
  deadline: 'vegetable',
  delivery: [{
    zone: 0,
    deliverable: true,
    price: 0
  }, {
    zone: 1,
    deliverable: true,
    price: 5000
  }, {
    zone: 2,
    deliverable: false,
    price: 10000
  }, {
    zone: 3,
    deliverable: false,
    price: 10000
  }]
};

module.exports.test.orders.collection = {
  details: { name: 'Test Order', email: 'test.order@gmail.com', telephone: '0123456789' },
  delivery: { date: '2020-35-3', type: 'collection', notes: '' },
  payment: { rebateCodes: [], method: 'Invoice', status: 'Paid' }
};

module.exports.test.orders.twoRecipients = {
  details: { name: 'Test Purchaser', email: 'test.order@gmail.com', telephone: '0123456789' },
  delivery: { date: '2020-16-3', type: 'split-delivery' },
  recipients: [{
    details: { name: 'Recipient 1', telephone: '01111111111' },
    delivery: {
      address: 'Fake 1A, 181 62 Stockholm, Sweden', addressNotes: 'House', googleFormattedAddress: 'Fake 1A, 181 62 Stockholm, Sweden', zone: 1, message: '', sms: "Your Treat Box from WHISK is now outside your door! Fika är viktigt när man jobbar hemifrån 😊 Sköt om dig! Anders\n\nWe've tried to keep true to our sustainable packaging with this new option. The foil pie tin is perfect for reheating things in the oven or making a pie. It's dishwasher safe and can be used many times! Our friends at Cajsa Warg helped out with the perfect sized bags and its uses are endless & here are some ideas smarturl.it/BagIdeas \n\nwww.whisk.se", order: 11
    }
  }, {
    details: { name: 'Recipient 2', telephone: '02222222222' },
    delivery: {
      address: 'Fake 2B, 114 59 Solna, Sweden', addressNotes: '', googleFormattedAddress: 'Fake 2B, 114 59 Solna, Sweden', zone: 3, message: '', sms: "Your Treat Box from WHISK is now outside your door! Fika är viktigt när man jobbar hemifrån 😊 Sköt om dig! Anders\n\nWe've tried to keep true to our sustainable packaging with this new option. The foil pie tin is perfect for reheating things in the oven or making a pie. It's dishwasher safe and can be used many times! Our friends at Cajsa Warg helped out with the perfect sized bags and its uses are endless & here are some ideas smarturl.it/BagIdeas \n\nwww.whisk.se", order: 13
    }
  }],
  payment: { rebateCodes: ['TESTINGCODE'], method: 'Invoice', status: 'Paid' }
};

module.exports.test.settings.rebateCodes = {
  type: 'rebateCodes',
  codes: [
    {
      code: 'TESTINGCODE',
      type: 'zone3Delivery'
    },
    {
      code: 'COSTPRICETEST',
      type: 'costPrice'
    }
  ]
};
