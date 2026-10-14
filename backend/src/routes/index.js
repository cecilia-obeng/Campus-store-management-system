const express = require('express');
const healthController = require('../controllers/healthController');

// All /api routes are registered here.
const router = express.Router();

router.get('/health', healthController.check);

module.exports = router;
