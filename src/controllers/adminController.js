const Joi = require('joi');
const { Order, OrderItem, User } = require('../models');

exports.listOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const { count, rows } = await Order.findAndCountAll({ where, limit, offset, include: [OrderItem, User], order: [['createdAt','DESC']] });
    res.json({ total: count, page, limit, items: rows });
  } catch (err) { next(err); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const schema = Joi.object({ status: Joi.string().valid('PENDING_PAYMENT','PAID','SHIPPED','DELIVERED','CANCELLED').required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    order.status = value.status;
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
};
