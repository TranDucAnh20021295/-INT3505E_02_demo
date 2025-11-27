const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    updated_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Product', productSchema);
