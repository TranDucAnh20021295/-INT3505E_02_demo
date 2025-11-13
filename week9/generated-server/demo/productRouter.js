const express = require('express');
const router = express.Router();
const ctrl = require('./ProductController');

router.get('/products', ctrl.listProducts);
router.post('/products', ctrl.createProduct);
router.get('/products/:id', ctrl.getProductById);
router.put('/products/:id', ctrl.updateProductById);
router.delete('/products/:id', ctrl.deleteProductById);

module.exports = router;
