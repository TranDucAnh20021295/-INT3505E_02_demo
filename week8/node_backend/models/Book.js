const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    available: { type: Number, default: 1, min: 0 },
    updated_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Book', bookSchema);


