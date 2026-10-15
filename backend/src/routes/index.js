const express = require('express');
const healthController = require('../controllers/healthController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');

// All /api routes are registered here.
const router = express.Router();

router.get('/health', healthController.check);

router.get('/categories', categoryController.list);

router.get('/products', productController.list);
router.get('/products/:id', productController.get);

module.exports = router;
