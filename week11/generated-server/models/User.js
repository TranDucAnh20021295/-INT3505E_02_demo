const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('User', userSchema);
