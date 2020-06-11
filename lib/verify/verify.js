// Page Tag
const tag = 'whisk-management:verify';

// Requirements
const debug = require('debug')(tag);

function verification() {
  function verify(input, type) {
    // Make sure input is string or number
    if (typeof input !== 'string' && typeof input !== 'number') {
      return false;
    }

    // Make sure type is a string
    if (typeof type !== 'string') {
      return false;
    }
    const str = input.toString();

    // Make sure input is not empty
    if (str.length < 1) {
      return false;
    }

    let reg;
    let emailSplit;
    let domainSplit;
    let phoneNumber;
    switch (type.toLowerCase()) {
      // Anything that can be represented by a string
      // Not empty
      case 'string':
        return true;

      // Persons name
      case 'name':
        reg = /[^a-zA-ZåäöéÅÄÖÉ -]/;
        return !reg.test(str);

      // Number
      case 'number':
        reg = /[^0-9-.]/;
        return !reg.test(str);

      // E-Mail Address
      case 'email':
        emailSplit = str.split('@');
        if (emailSplit.length < 2) {
          return false;
        }

        domainSplit = emailSplit[emailSplit.length - 1].split('.');
        if (domainSplit.length < 2) {
          return false;
        }

        reg = /[^a-zA-Z0-9-]/;
        return !reg.test(domainSplit[0]);

      case 'telephone':
        phoneNumber = str.replace(/-/g, '')
          .replace(/ /g, '')
          .replace('(', '')
          .replace(')', '');
        if ((phoneNumber.charAt(0) !== '0' && phoneNumber.charAt(0) !== '+')
          || phoneNumber.length < 10) {
          return false;
        }
        reg = /[^0-9+]/;
        return !reg.test(phoneNumber);

      // Invalid type
      default:
        return false;
    }
  }

  return { verify };
}

module.exports = verification;
