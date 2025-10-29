const Book = require('../models/Book');
const Counter = require('../models/Counter');

async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return result.seq;
}

exports.listBooks = async (req, res) => {
  try {
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const search = (req.query.search || '').trim();
    const sortBy = (req.query.sort_by || 'id');
    const sortOrder = (req.query.sort_order || 'asc').toLowerCase() === 'desc' ? -1 : 1;

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    const validSortFields = ['id', 'title', 'author', 'available', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
    const sort = { [sortField]: sortOrder };

    const total = await Book.countDocuments(filter);
    const items = await Book.find(filter).sort(sort).skip(offset).limit(limit).lean();

    const data = items.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      available: b.available,
      updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : null
    }));

    return res.json({
      data,
      pagination: {
        offset,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
        has_prev: offset > 0,
        next_num: offset + limit < total ? Math.floor(offset / limit) + 2 : null,
        prev_num: offset > 0 ? Math.floor((offset - 1) / limit) + 1 : null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list books' });
  }
};

exports.createBook = async (req, res) => {
  try {
    const { title, author } = req.body || {};
    if (!title || !author) {
      return res.status(400).json({ error: 'title and author are required' });
    }
    const id = await getNextSequence('books');
    const created = await Book.create({ id, title, author, available: 1, updated_at: new Date() });
    return res.status(201).json({ message: 'Book created', id: created.id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create book' });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const b = await Book.findOne({ id }).lean();
    if (!b) return res.status(404).json({ error: 'Book not found' });
    return res.json({ id: b.id, title: b.title, author: b.author });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get book' });
  }
};

exports.updateBookById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const update = { ...req.body, updated_at: new Date() };
    const updated = await Book.findOneAndUpdate({ id }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Book not found' });
    return res.json({ message: 'Book updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update book' });
  }
};

exports.deleteBookById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const r = await Book.findOneAndDelete({ id }).lean();
    if (!r) return res.status(404).json({ error: 'Book not found' });
    return res.json({ message: 'Book deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete book' });
  }
};


