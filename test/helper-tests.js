// Requirements
const assert = require('assert').strict;
const {
  priceFormat,
  parseMarkers,
  parseTime,
  calculateMoms,
  calculateNetCost,
  dateFormat,
  parseDateCode,
  getGoogleMapsUrl,
  getGoogleMapsDirections,
  getReadableOrder,
  generateRandomString
} = require('../src/helpers');

describe('Helper Function Tests', () => {
  describe('The functions...', () => {
    it('convert number to price format (with currency symbol)', () => {
      assert.equal(priceFormat(1000), '10 SEK');
      assert.equal(priceFormat(786), '8 SEK');
      assert.equal(priceFormat(), '0 SEK');
      assert.equal(priceFormat(123456789), '1234568 SEK');
      assert.equal(priceFormat(5.687), '0 SEK');
      assert.equal(priceFormat(758.415), '8 SEK');
      assert.equal(priceFormat(749.999999999), '7 SEK');
      assert.equal(priceFormat(750), '8 SEK');
      assert.equal(priceFormat(-97297), '-973 SEK');
    });

    it('convert number to price format (without currency symbol)', () => {
      assert.equal(priceFormat(0, { includeSymbol: false }), '0');
      assert.equal(priceFormat(123456789, { includeSymbol: false }), '1234568');
      assert.equal(priceFormat(12345678901234567, { includeSymbol: false }), '123456789012346');
    });

    it('convert number to price format (with öre and currency symbol)', () => {
      assert.equal(priceFormat(786, { includeOre: true }), '7.86 SEK');
      assert.equal(priceFormat(1, { includeOre: true }), '0.01 SEK');
    });

    it('parse date to readable format', () => {
      assert.equal(dateFormat('2020-32-3', { parseCode: true }), 'Wednesday 5th August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z'), 'Monday 3rd August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'short' }), '2020/8/3 9:22:40pm');
      assert.equal(dateFormat('2017-11-09T14:18:10.785Z', { format: 'short' }), '2017/11/9 3:18:10pm');
      assert.equal(dateFormat('2002-10-14T09:04:06.976Z', { format: 'short' }), '2002/10/14 11:04:06am');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'date' }), '3/8/2020');
      assert.equal(dateFormat('2001-11-24T01:19:24.546Z', { format: 'date' }), '24/11/2001');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'dateFormatter' }), '2020-08-03');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'time' }), '9:22 PM');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'long' }), 'Monday 3rd August 2020');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'long', includeWeek: true }), 'Monday 3rd August 2020 (Week 32)');
      assert.equal(dateFormat('2020-08-03T19:22:40.192Z', { format: 'invalid' }), 'Monday 3rd August 2020');
    });

    it('parses time', () => {
      assert.equal(parseTime('24:00'), false);
      assert.equal(parseTime('000:00'), false);
      assert.equal(parseTime('1:25'), false);
      assert.equal(parseTime('19:60'), false);
      assert.equal(parseTime('21:61'), false);
      assert.deepEqual(parseTime('21:59'), { hour: 21, minute: 59 });
      assert.deepEqual(parseTime('00:00'), { hour: 0, minute: 0 });
      assert.equal(parseTime('09:00').hour, 9);
      assert.equal(parseTime('13:24').hour, 13);
      assert.equal(parseTime('05:29').minute, 29);
      assert.equal(parseTime('00:01').minute, 1);
    });

    it('calculate MOMs (rounded) from gross price and MOMs rate (as percentage)', () => {
      assert.equal(calculateMoms(112, 12), 12);
      assert.equal(calculateMoms(1300, 12), 139);
      assert.equal(calculateMoms(10, 25), 2);
      assert.equal(calculateMoms(1798, 0), 0);
      assert.equal(calculateMoms(-1798, 25), -360);
      assert.equal(calculateMoms(1798, 25), 360);
      assert.equal(calculateMoms(0, 25), 0);
    });

    it('calculate net cost (rounded) from gross cost and MOMs rate (as percentage)', () => {
      assert.equal(calculateNetCost(112, 12), 100);
      assert.equal(calculateNetCost(425, 12), 379);
      assert.equal(calculateNetCost(0, 12), 0);
      assert.equal(calculateNetCost(-165, 12), -147);
      assert.equal(calculateNetCost(1785, 0), 1785);
      assert.equal(calculateNetCost(6582, 25), 5266);
    });

    it('parse date code (YEAR-WEEK-DAYOFWEEK) into components', () => {
      let parsedCode = parseDateCode('2017-24-5');
      assert.equal(parsedCode.year, 2017);
      assert.equal(parsedCode.week, 24);
      assert.equal(parsedCode.day, 5);
      assert.equal(parsedCode.date, '2017-06-16T00:00:00Z');
      parsedCode = parseDateCode('2003-2-2');
      assert.equal(parsedCode.year, 2003);
      assert.equal(parsedCode.week, 2);
      assert.equal(parsedCode.day, 2);
      assert.equal(parsedCode.date, '2003-01-07T00:00:00Z');
      assert.equal(parseDateCode('2006-65-6').date, 'Invalid date');
      assert.equal(parseDateCode('2009-0-7').date, 'Invalid date');
      assert.equal(parseDateCode('2013-1-1').date, '2012-12-31T00:00:00Z');
    });

    it('return a Google Maps place link', () => {
      assert.equal(getGoogleMapsUrl('Smebacksvägen 14, 690 45 Åsbro, Sweden'),
        'https://www.google.com/maps/search/?api=1&query=Smebacksv%C3%A4gen%2014%2C%20690%2045%20%C3%85sbro%2C%20Sweden');
    });

    it('return a Google Maps directions link', () => {
      assert.equal(getGoogleMapsDirections('Smebacksvägen 14, 690 45 Åsbro, Sweden'),
        'https://www.google.com/maps/dir/?api=1&destination=Smebacksv%C3%A4gen%2014%2C%20690%2045%20%C3%85sbro%2C%20Sweden&travelmode=driving&dir_action=navigate');
    });

    it('return a random string of alphanumeric characters', () => {
      const length = Math.floor(Math.random() * 500);
      const str = generateRandomString(length);
      assert.equal(str.length, length);
      const re = /^[0-9A-Z]*$/i;
      assert(re.test(str));
    });
  });

  describe('Create a readable order list from...', () => {
    it('0 items', () => {
      const order = [];
      assert.equal(getReadableOrder(order), '');
    });

    it('1 item', () => {
      const order = [
        { name: 'Treat Box', quantity: 2 }
      ];
      assert.equal(getReadableOrder(order), '2 x Treat Box');
    });

    it('2 items', () => {
      const order = [
        { name: 'Python Skin', quantity: 224 },
        { name: 'Zebra Hide', quantity: 3 }
      ];
      assert.equal(getReadableOrder(order), '224 x Python Skin, 3 x Zebra Hide');
    });

    it('3 items', () => {
      const order = [
        { name: 'Frozen DVD', quantity: 879.4 },
        { name: 'Frozen Soundtrack', quantity: -3 },
        { name: 'Frozen Apparel', quantity: 0 }
      ];
      assert.equal(getReadableOrder(order), '879.4 x Frozen DVD, -3 x Frozen Soundtrack, 0 x Frozen Apparel');
    });
  });

  describe('Parse Markers', () => {
    it('parses markers', () => {
      const recipient = {
        items: [{
          id: '5f04f04d77576c0017232c82',
          quantity: 1,
          name: 'Combo Box'
        }],
        details: {
          name: 'Anna Malkan',
          telephone: '0124456789'
        },
        delivery: {
          address: 'Hagagatan 18, 113 48 Stockholm, Sweden',
          addressNotes: '1704 4th floor',
          googleFormattedAddress: 'Hagagatan 18, 113 48 Stockholm, Sweden',
          zone: 1,
          message: 'This is a message for you.',
          sms: "Your Treat Box from WHISK is now outside your door!\r\n\r\nWe've tried to keep true to our sustainable packaging with this new option. The foil tin is perfect for reheating things in the oven. It's dishwasher safe and can be used many times! Our friends at Too Good To Go helped out with the perfect sized bags and its uses are endless & here are some ideas smarturl.it/BagIdeas \r\n\r\nwww.whisk.se",
          order: 106
        }
      };

      let str = 'Hi %name, hello.';
      assert.equal(parseMarkers(str, recipient), 'Hi Anna Malkan, hello.');

      str = 'Thanks for the order.%message';
      assert.equal(parseMarkers(str, recipient), 'Thanks for the order.\nThis is a message for you.\n');

      str = 'Thanks for the order.';
      assert.equal(parseMarkers(str, recipient), 'Thanks for the order.');

      str = 'Your %order from Whisk is on the way.';
      assert.equal(parseMarkers(str, recipient), 'Your 1 x Combo Box from Whisk is on the way.');
    });
  });
});
