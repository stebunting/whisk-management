// File tag
const tag = 'whisk-management';

// Requirements
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('cookie-session');
const debug = require('debug')(tag);
const { loginCheck } = require('./src/controllers/authController')();

// App configuration
const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ keys: [process.env.SESSION_SECRET] }));
app.set('view engine', 'ejs');

// Paths
app.set('views', './src/views');

// Connect to MongoDB
const dbController = require('./src/controllers/dbController')(tag);

dbController.connect();

// Configure Passport
require('./src/config/passport.js')(app);

// Routing
const userRouter = require('./src/routes/userRoutes')();
const authRouter = require('./src/routes/authRoutes')();
const adminRouter = require('./src/routes/adminRoutes')();

app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);

// Entry Point
app.all('/', loginCheck);
app.get('/', (req, res) => {
  res.send('You are signed in');
});

// Start Server
app.listen(port, () => {
  debug(`Express server listening on port ${port}...`);
});
