require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

app.use(express.json());
app.use('/images', express.static(path.join(DATA_DIR, 'images')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`iPhone Zambia Shop running on http://localhost:${PORT}`);
});
