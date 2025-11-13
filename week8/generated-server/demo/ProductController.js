const Product = require('./ProductModel');
const Counter = require('../models/Counter');

function toInt(x, d = 0) { const v = parseInt(x, 10); return Number.isNaN(v) ? d : v; }
async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return result.seq;
}

exports.listProducts = async (req, res) => {
  try {
    const offset = toInt(req.query.offset, 0);
    const limit = Math.min(Math.max(toInt(req.query.limit, 10), 1), 100);
    const total = await Product.countDocuments({});
    const items = await Product.find({}).sort({ id: 1 }).skip(offset).limit(limit).lean();
    return res.json({
      data: items,
      pagination: {
        offset,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
        has_prev: offset > 0,
        next_num: offset + limit < total ? Math.floor(offset / limit) + 2 : null,
        prev_num: offset > 0 ? Math.floor((offset - 1) / limit) + 1 : null,
      }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list products' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, price, stock } = req.body || {};
    if (!name || (price === undefined)) return res.status(400).json({ error: 'name and price are required' });
    const id = await getNextSequence('products');
    const created = await Product.create({ id, name, price, stock: toInt(stock, 0), updated_at: new Date() });
    return res.status(201).json({ message: 'Product created', id: created.id });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create product' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const p = await Product.findOne({ id }).lean();
    if (!p) return res.status(404).json({ error: 'Product not found' });
    return res.json(p);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get product' });
  }
};

exports.updateProductById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const update = { ...req.body, updated_at: new Date() };
    const updated = await Product.findOneAndUpdate({ id }, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product updated' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update product' });
  }
};

exports.deleteProductById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const deleted = await Product.findOneAndDelete({ id }).lean();
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product deleted' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }
};
