const { Order, Product } = require('../models');

const jobs = [];

function processJob(job) {
  if (job.type === 'send_email') {
    console.log(`[Job] Sending confirmation email for order ${job.orderId}`);
    // Simulate async work
  } else if (job.type === 'payment_timeout') {
    // If order still pending, cancel and release reserved stock
    (async () => {
      const order = await Order.findByPk(job.orderId);
      if (!order) return;
      if (order.status !== 'PENDING_PAYMENT') return;
      console.log(`[Job] Cancelling order ${order.id} due to payment timeout`);
      const items = await order.getOrderItems();
      for (const it of items) {
        const product = await Product.findByPk(it.productId);
        if (!product) continue;
        product.reservedStock = Math.max(0, product.reservedStock - it.quantity);
        await product.save();
      }
      order.status = 'CANCELLED';
      await order.save();
    })();
  }
}

function enqueueJob(job, delay = 0) {
  if (delay > 0) {
    setTimeout(() => processJob(job), delay);
  } else {
    setImmediate(() => processJob(job));
  }
  jobs.push({ job, enqueuedAt: Date.now(), delay });
}

module.exports = { enqueueJob, jobs };
