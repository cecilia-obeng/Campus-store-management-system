const express = require('express');
const healthController = require('../controllers/healthController');
const categoryController = require('../controllers/categoryController');

// All /api routes are registered here.
const router = express.Router();

router.get('/health', healthController.check);

router.get('/categories', categoryController.list);

module.exports = router;
