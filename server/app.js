const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/index.js');

const { createProxyMiddleware } = require("http-proxy-middleware");

dotenv.config();
const app = express();

app.use("/ide", createProxyMiddleware({
    target: "http://127.0.0.1:8088",
    ws: true,
    changeOrigin: true,
    pathRewrite: { "^/ide": ""},
}));

app.use(cors());
app.use(express.json());

app.use("/api/v1", apiRoutes);

module.exports = app;