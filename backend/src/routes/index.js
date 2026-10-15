const express = require('express');
const healthController = require('../controllers/healthController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const saleController = require('../controllers/saleController');

// All /api routes are registered here.
const router = express.Router();

router.get('/health', healthController.check);

router.get('/categories', categoryController.list);

router.get('/products', productController.list);
router.post('/products', productController.create);
router.get('/products/:id', productController.get);
router.put('/products/:id', productController.update);
router.delete('/products/:id', productController.remove);

router.post('/sales', saleController.create);

module.exports = router;
