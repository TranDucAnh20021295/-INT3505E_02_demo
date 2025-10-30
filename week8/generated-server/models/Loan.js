const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    book_id: { type: Number, required: true, index: true },
    borrow_date: { type: String, required: true },
    return_date: { type: String, required: true },
    actual_return_date: { type: String, default: null },
    status: { type: String, enum: ['borrowed', 'returned'], default: 'borrowed' }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Loan', loanSchema);
