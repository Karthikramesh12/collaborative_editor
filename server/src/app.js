const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/index.js');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1", apiRoutes);

module.exports = app;