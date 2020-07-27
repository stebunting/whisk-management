// Page Tag
const tag = 'whisk-management:authRoutes';

// Requirements
const express = require('express');
const passport = require('passport');
const debug = require('debug')(tag);

function routes() {
  const authRoutes = express.Router();

  authRoutes.route('/signin')
    .get((req, res) => {
      res.render('signin');
    })
    .post(passport.authenticate('local', {
      successRedirect: '/user/dashboard',
      failureRedirect: '/auth/signin'
    }));

  authRoutes.route('/logout')
    .get((req, res) => {
      req.logout();
      req.flash('success', 'You were Logged Out!');
      res.redirect('/auth/signin');
    });

  return authRoutes;
}

module.exports = routes;
