const Joi = require('joi');
const { Product } = require('../models');

exports.create = async (req, res, next) => {
  try {
    const schema = Joi.object({ name: Joi.string().required(), description: Joi.string().allow(''), price: Joi.number().precision(2).required(), availableStock: Joi.number().integer().min(0).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const product = await Product.create(value);
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    await product.update(req.body);
    res.json(product);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    await product.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;
    const where = {};
    if (req.query.name) where.name = { [require('sequelize').Op.like]: `%${req.query.name}%` };
    const order = [];
    if (req.query.sortBy) {
      const dir = req.query.order === 'desc' ? 'DESC' : 'ASC';
      order.push([req.query.sortBy, dir]);
    }
    const { count, rows } = await Product.findAndCountAll({ where, limit, offset, order });
    res.json({ total: count, page, limit, items: rows });
  } catch (err) { next(err); }
};
