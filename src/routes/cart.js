const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', cartController.addOrUpdateItem);
router.delete('/items/:productId', cartController.removeItem);

module.exports = router;
