// Requirements
const assert = require('assert');
const {
  isConnected,
  connect,
  sendConfirmationEmail
} = require('../lib/email/email')();

describe('E-Mail Tests', () => {
  describe('Send confirmation email to user', () => {
    it('transporter not yet connected', async () => {
      await assert.rejects(isConnected(), (error) => {
        assert.equal(error.message, 'Not connected to SMTP server');
        return true;
      });
    });

    it('does not send email before transporter created', async () => {
      const order = {
        details: {
          name: 'Test User',
          email: 'stebunting@gmail.com',
          telephone: '07787448962'
        },
        delivery: {
          date: '2020-5-3'
        }
      };
      await assert.rejects(sendConfirmationEmail(order), (error) => {
        assert.equal(error.message, 'Not connected to SMTP server');
        return true;
      });
    });

    it('creates transporter', async () => {
      const response = await connect();
      assert.ok(response);
    });

    it('sends confirmation email', async () => {
      const order = {
        details: {
          name: 'Ste',
          email: 'stebunting@gmail.com',
          telephone: '0733283460'
        },
        delivery: {
          date: '2020-32-3',
          type: 'delivery'
        },
        recipients: [
          {
            items: [
              {
                id: '5efdb404924869811d60da4e',
                quantity: 1,
                name: 'Treat Box'
              }
            ],
            details: {
              name: 'Ste',
              telephone: '0733283460'
            },
            delivery: {
              address: 'Sandhamnsgatan, Stockholm, Sweden',
              addressNotes: 'Some Notes',
              googleFormattedAddress: 'Sandhamnsgatan, Stockholm, Sweden',
              zone: 1,
              message: '',
              sms: "Your Treat Box from WHISK is now outside your door!\r\n\r\nWe've tried to keep true to our sustainable packaging with this new option. The foil tin is perfect for reheating things in the oven. It's dishwasher safe and can be used many times! Our friends at Too Good To Go helped out with the perfect sized bags and its uses are endless & here are some ideas smarturl.it/BagIdeas \r\n\r\nwww.whisk.se",
              order: 7
            }
          }
        ],
        payment: {
          method: 'Invoice',
          status: 'Ordered',
          rebateCodes: [
            'TEST'
          ]
        },
        statement: {
          products: [
            {
              id: '5efdb404924869811d60da4e',
              name: 'Treat Box',
              quantity: 1,
              price: 25000,
              momsAmount: 2679,
              momsRate: 12,
              subTotal: 25000,
              momsSubTotal: 2679
            }
          ],
          bottomLine: {
            foodCost: 25000,
            deliveryCost: 0,
            foodMoms: 2679,
            deliveryMoms: 0,
            totalMoms: 2679,
            total: 25000
          },
          delivery: {}
        }
      };
      const response = await sendConfirmationEmail(order);
      assert.equal(response.response.substr(0, 6), '250 OK');
    });
  });
});
