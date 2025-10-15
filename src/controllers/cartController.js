const Joi = require('joi');
const { CartItem, Product } = require('../models');

exports.getCart = async (req, res, next) => {
  try {
    const items = await CartItem.findAll({ where: { userId: req.user.id }, include: [Product] });
    res.json(items);
  } catch (err) { next(err); }
};

exports.addOrUpdateItem = async (req, res, next) => {
  try {
    const schema = Joi.object({ productId: Joi.number().integer().required(), quantity: Joi.number().integer().min(1).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const product = await Product.findByPk(value.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    let item = await CartItem.findOne({ where: { userId: req.user.id, productId: value.productId } });
    if (item) {
      item.quantity = value.quantity;
      await item.save();
    } else {
      item = await CartItem.create({ userId: req.user.id, productId: value.productId, quantity: value.quantity });
    }
    res.json(item);
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const item = await CartItem.findOne({ where: { userId: req.user.id, productId } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};
