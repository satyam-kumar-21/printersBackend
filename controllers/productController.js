const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// Multer Configuration
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        console.log(`File rejected: ${file.originalname}, mimetype: ${file.mimetype}`);
        cb('Images only (jpg, jpeg, png)!');
    }
}

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        console.log('Multer filtering file:', file.originalname);
        checkFileType(file, cb);
    }
});

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const categoryName = req.query.category;
    let query = {};
    
    if (categoryName && categoryName !== 'undefined' && categoryName !== 'null') {
        const Category = require('../models/Category');
        const category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
        if (category) {
            query.category = category._id;
        }
    }

    const products = await Product.find(query).populate('category', 'name');
    res.json(products);
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    let product;
    
    const idOrSlug = req.params.id;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
        product = await Product.findById(idOrSlug).populate('category', 'name');
    } else {
        // 1. Search by exact slug
        product = await Product.findOne({ slug: idOrSlug }).populate('category', 'name');

        // 2. Fallback: Search by title (fuzzy/regex)
        if (!product) {
            // Convert slug back to a potential title pattern (dashes to spaces, etc.)
            const titlePattern = idOrSlug.replace(/-/g, ' ');
            product = await Product.findOne({
                title: { $regex: new RegExp(`^${titlePattern}$`, 'i') }
            }).populate('category', 'name');
        }

        // 3. Last Resort Fallback: Match any product where title contains most of the slug
        // (helpful if "-admin" was appended or minor differences exist)
        if (!product) {
            const parts = idOrSlug.split('-');
            const firstFewParts = parts.slice(0, Math.min(parts.length, 3)).join(' ');
            if (firstFewParts.length > 5) {
                product = await Product.findOne({
                    title: { $regex: new RegExp(firstFewParts, 'i') }
                }).populate('category', 'name');
            }
        }
    }

    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    try {
        console.log('CREATE PRODUCT BODY:', req.body);
        console.log('CREATE PRODUCT FILES:', req.files);

        let imagePaths = [];
        if (req.files) {
            imagePaths = req.files.map(file => `/uploads/${file.filename}`);
        }

        const {
            title, brand, category, price, oldPrice, countInStock, description,
            shortDetails, shortSpecification, overview, technicalSpecification,
            color, width, height, depth, screenSize, reviews
        } = req.body;

        if (!title || !price || !category) {
            res.status(400);
            throw new Error('Please provide title, price, and category');
        }

        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, user not found');
        }

        let parsedReviews = [];
        if (reviews) {
            parsedReviews = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");

        const product = new Product({
            user: req.user._id,
            title,
            slug,
            brand: brand || 'Generic',
            category,
            price: Number(price) || 0,
            oldPrice: oldPrice ? Number(oldPrice) : 0,
            countInStock: Number(countInStock) || 0,
            description: description || '',
            shortDetails,
            shortSpecification,
            overview,
            technicalSpecification,
            images: imagePaths,
            color, width, height, depth, screenSize,
            reviews: parsedReviews,
            numReviews: parsedReviews.length,
            rating: parsedReviews.length > 0 
                ? parsedReviews.reduce((acc, item) => item.rating + acc, 0) / parsedReviews.length 
                : 0
        });

        const createdProduct = await product.save();
        console.log('PRODUCT CREATED SUCCESSFULLY:', createdProduct._id);
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        throw error;
    }
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
    console.log('UPDATE PRODUCT ID:', req.params.id);
    console.log('UPDATE PRODUCT BODY:', req.body);
    console.log('UPDATE PRODUCT FILES:', req.files);

    const {
        title, brand, category, price, oldPrice, countInStock, description,
        shortDetails, shortSpecification, overview, technicalSpecification,
        color, width, height, depth, screenSize, existingImages, reviews
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
            product.title = title || product.title;
            product.slug = title ? title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-") : product.slug;
            product.brand = brand || product.brand;
        product.category = category || product.category;
        product.price = price || product.price;
        product.oldPrice = oldPrice ?? product.oldPrice;
        product.countInStock = countInStock ?? product.countInStock;
        product.description = description || product.description;
        product.shortDetails = shortDetails ?? product.shortDetails;
        product.shortSpecification = shortSpecification ?? product.shortSpecification;
        product.overview = overview ?? product.overview;
        product.technicalSpecification = technicalSpecification ?? product.technicalSpecification;
        product.color = color ?? product.color;
        product.width = width ?? product.width;
        product.height = height ?? product.height;
        product.depth = depth ?? product.depth;
        product.screenSize = screenSize ?? product.screenSize;

        // Image Update Logic
        let currentImages = [];
        if (existingImages) {
            // Handle JSON string from FormData
            currentImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
        } else if (req.body.images) {
            // Fallback to legacy field name if present but not as files
            currentImages = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
        } else {
            currentImages = product.images;
        }

        if (req.files && req.files.length > 0) {
            const newImagePaths = req.files.map(file => `/uploads/${file.filename}`);
            product.images = [...currentImages, ...newImagePaths];
        } else {
            product.images = currentImages;
        }

        // Reviews Update Logic (Admin can add multiple reviews)
        if (reviews) {
            const parsedReviews = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
            product.reviews = parsedReviews;
            product.numReviews = parsedReviews.length;
            product.rating = parsedReviews.length > 0 
                ? parsedReviews.reduce((acc, item) => item.rating + acc, 0) / parsedReviews.length 
                : 0;
        }

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    upload
};
