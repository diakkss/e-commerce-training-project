const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();
const authJwt = require('./middleware/jwt');
const errorHandler = require('./middleware/error-handler');
const cookieParser = require('cookie-parser');
// Middleware
app.use(bodyParser.json());

app.use(cookieParser());

app.use(morgan('tiny'));

// Diagnostic log middleware
// app.use((req, res, next) => {
//     console.log(`Request URL: ${req.url}`);
//     next();
// });

// Routes
const productsRoutes = require('./routers/products');
const usersRoutes = require('./routers/users');
const ordersRoutes = require('./routers/orders');
const deliverysRoutes = require('./routers/deliverys');

const api = process.env.API_REST;
const connection = process.env.MONGO_URI;

// Public routes
app.use(`${api}/users`, usersRoutes);

// JWT middleware (only for protected routes)
app.use(authJwt());

// Protected routes
app.use(`${api}/products`, productsRoutes);
app.use(`${api}/orders`, ordersRoutes);
app.use(`${api}/delivery`, deliverysRoutes);

// Error handler middleware
app.use(errorHandler);

// Database connection
mongoose.connect(connection)
  .then(() => {
    console.log('Database Connection Successful');
  })
  .catch((err) => {
    console.error('Database Connection Error:', err);
  });

app.listen(3000, () => {
  console.log(`Server is running at http://localhost:3000${api}`);
});
