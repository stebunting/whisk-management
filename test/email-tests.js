// Page Tag
const tag = 'whisk-management:email-tests';

// Requirements
const assert = require('assert');
const {
  isConnected,
  connect,
  sendConfirmationEmail
} = require('../lib/email/email')(tag);

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
        purchaser: {
          name: 'Test User',
          email: 'stebunting@gmail.com',
          telephone: '07787448962'
        }
      };
      await assert.rejects(sendConfirmationEmail(order), (error) => {
        assert.equal(error.message, 'Not connected to SMTP server');
        return true;
      });
    })

    it('creates transporter', async () => {
      const response = await connect();
      assert.ok(response);
    });

    it.skip('sends confirmation email', async () => {
      const order = {
        itemsOrdered: {
          comboBoxes: 1,
          treatBoxes: 0,
          vegetableBoxes: 1
        },
        purchaser: {
          name: 'Test User',
          email: 'stebunting@gmail.com',
          telephone: '07787448962'
        },
        delivery: {
          date: 'Wednesday 17th June',
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
            numComboBoxes: 1,
            numTreatBoxes: 0,
            numVegetableBoxes: 1,
            name: 'Stephen Bunting',
            telephone: '07754326547',
            address: 'Sandhamnsgatan 57, 115 28 Stockholm, Sweden',
            addressNotes: 'Doorcode 2288',
            zone: 1,
            message: 'Message for Ste'
          }
        ]
      };
      const response = await sendConfirmationEmail(order);
      assert.equal(response.response.substr(0, 6), '250 OK');
    });
  });
});
