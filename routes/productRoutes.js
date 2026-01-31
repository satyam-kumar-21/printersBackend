const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, upload, uploadExcel, getSearchSuggestions, bulkUploadProducts } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, admin, upload.array('images', 5), createProduct);

router.route('/bulk-upload').post(protect, admin, uploadExcel.single('excelFile'), bulkUploadProducts);

router.route('/search/suggestions').get(getSearchSuggestions);

router.route('/:id')
    .get(getProductById)
    .put(protect, admin, upload.array('images', 5), updateProduct)
    .delete(protect, admin, deleteProduct);

module.exports = router;
