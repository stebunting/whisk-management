// Page Tag
const tag = 'whisk-management:passport';

// Requirements
const passport = require('passport');
const { Strategy } = require('passport-local');
const bcrypt = require('bcrypt');
const debug = require('debug')(tag);
const { getUser, logError } = require('../../lib/db-control')(tag);

function passportConfig(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  // Store user in session
  passport.serializeUser((user, done) => {
    done(null, user.username);
  });

  // Retrieve user from session
  passport.deserializeUser(async (username, done) => {
    const user = await getUser(username);
    done(null, user);
  });

  // Define Login Strategy
  passport.use(new Strategy({
    usernameField: 'username',
    passwordField: 'password'
  }, async (username, password, done) => {
    try {
      const user = await getUser(username.toLowerCase());

      // User not found in database
      if (user === null) {
        return done(null, false);
      }

      // Check password
      const passwordCompare = await bcrypt.compare(password, user.password);
      if (passwordCompare) {
        return done(null, user);
      }
    } catch (error) {
      logError('Could not check for user in database', error);
    }
    return done(null, false);
  }));
}

module.exports = passportConfig;
