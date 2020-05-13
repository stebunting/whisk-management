// Page Tag
const tag = 'whisk-management:authController';

// Requirements
const debug = require('debug')(tag);

function authController() {
  // Middleware to ensure user logged-in
  function loginCheck(req, res, next) {
    if (req.user) {
      debug('Authorised');
      next();
    } else {
      debug('Unauthorised');
      res.redirect('/auth/signin');
    }
  }

  return { loginCheck };
}

module.exports = authController;
