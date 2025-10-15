const Joi = require('joi');
const { sequelize, CartItem, Product, Order, OrderItem, Payment } = require('../models');
const { enqueueJob } = require('../services/jobQueue');

// Checkout: reserve stock and create order within a transaction
exports.checkout = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cartItems = await CartItem.findAll({ where: { userId: req.user.id }, include: [Product], transaction: t, lock: t.LOCK.UPDATE });
    if (!cartItems.length) { await t.rollback(); return res.status(400).json({ error: 'Cart empty' }); }
    // Check stock and reserve
    for (const item of cartItems) {
      const product = await Product.findByPk(item.productId, { transaction: t, lock: t.LOCK.UPDATE });
      if (product.availableStock - product.reservedStock < item.quantity) {
        await t.rollback();
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      product.reservedStock += item.quantity;
      await product.save({ transaction: t });
    } 

    // Calculate total
    let total = 0;
    for (const item of cartItems) {
      total += parseFloat(item.Product.price) * item.quantity;
    }

    const order = await Order.create({ userId: req.user.id, totalAmount: total, status: 'PENDING_PAYMENT' }, { transaction: t });
    for (const item of cartItems) {
      await OrderItem.create({ orderId: order.id, productId: item.productId, quantity: item.quantity, priceAtPurchase: item.Product.price }, { transaction: t });
    }

    // Clear cart
    await CartItem.destroy({ where: { userId: req.user.id }, transaction: t });

    await t.commit();

    // Set a timeout job to cancel if not paid
    const timeoutMinutes = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES || '15');
    enqueueJob({ type: 'payment_timeout', orderId: order.id }, timeoutMinutes * 60 * 1000);

    res.status(201).json(order);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// Mock payment: finalize order, decrement availableStock, clear reservedStock, create payment record, enqueue email
exports.pay = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) { await t.rollback(); return res.status(404).json({ error: 'Order not found' }); }
    if (order.userId !== req.user.id) { await t.rollback(); return res.status(403).json({ error: 'Forbidden' }); }
    if (order.status !== 'PENDING_PAYMENT') { await t.rollback(); return res.status(400).json({ error: 'Order not pending payment' }); }

    const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t, lock: t.LOCK.UPDATE });

    // Finalize stock changes
    for (const it of items) {
      const product = await Product.findByPk(it.productId, { transaction: t, lock: t.LOCK.UPDATE });
      if (product.reservedStock < it.quantity) { await t.rollback(); return res.status(400).json({ error: 'Reserved stock inconsistency' }); }
      product.reservedStock -= it.quantity;
      product.availableStock -= it.quantity;
      if (product.availableStock < 0) { await t.rollback(); return res.status(400).json({ error: 'Insufficient stock during finalize' }); }
      await product.save({ transaction: t });
    }

    // Record payment
    await Payment.create({ orderId: order.id, transactionId: `tx_${Date.now()}`, amount: order.totalAmount, status: 'SUCCESS' }, { transaction: t });

    order.status = 'PAID';
    await order.save({ transaction: t });

    await t.commit();

    // Enqueue confirmation email job (async)
    enqueueJob({ type: 'send_email', orderId: order.id });

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.listUserOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;
    const { count, rows } = await Order.findAndCountAll({ where: { userId: req.user.id }, limit, offset, order: [['createdAt','DESC']] });
    res.json({ total: count, page, limit, items: rows });
  } catch (err) { next(err); }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [OrderItem] });
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(order);
  } catch (err) { next(err); }
};
