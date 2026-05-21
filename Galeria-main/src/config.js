const path = require("path");

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1"),
  publicDir: path.join(__dirname, "..", "public"),
};
