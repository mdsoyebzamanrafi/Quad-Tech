const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stock: { type: Number, default: 0 },
  price: { type: Number, required: true },
  image: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
