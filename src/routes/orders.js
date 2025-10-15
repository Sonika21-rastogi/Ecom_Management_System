const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.use(authenticate);

router.post('/checkout', orderController.checkout);
router.post('/:id/pay', orderController.pay);
router.get('/', orderController.listUserOrders);
router.get('/:id', orderController.getOrder);

module.exports = router;
