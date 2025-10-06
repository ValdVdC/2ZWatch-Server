const cors = require('cors');

const allowedOrigins = [
  'http://localhost:4200',
  'https://twozwatch.vercel.app'
];

module.exports = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});