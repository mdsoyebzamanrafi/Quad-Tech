const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const wishlistRoutes = require('./routes/wishlistRoutes');
const friendRoutes = require('./routes/friendRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/wishlist', wishlistRoutes);
app.use('/api/friends', friendRoutes);

const PORT = process.env.PORT || 5001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Wishlist & Friends Server running on port ${PORT}`);
  });
}

module.exports = app;
