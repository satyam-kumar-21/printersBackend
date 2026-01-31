const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const XLSX = require('xlsx');

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = multer.memoryStorage();

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|webp/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        console.log(`File rejected: ${file.originalname}, mimetype: ${file.mimetype}`);
        cb('Images only (jpg, jpeg, png, webp)!');
    }
}

const uploadExcel = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        const filetypes = /xlsx|xls/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Excel files only!');
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        console.log('Multer filtering file:', file.originalname);
        checkFileType(file, cb);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'products',
                public_id: `${Date.now()}-${filename}`,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' },
                    { quality: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );
        uploadStream.end(buffer);
    });
};

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const categoryName = req.query.category;
    const search = req.query.search;
    let query = {};
    
    if (categoryName && categoryName !== 'undefined' && categoryName !== 'null') {
        const Category = require('../models/Category');
        const category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
        if (category) {
            query.category = category._id;
        }
    }

    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { shortDetails: { $regex: search, $options: 'i' } },
            { shortSpecification: { $regex: search, $options: 'i' } },
            { overview: { $regex: search, $options: 'i' } },
            { technicalSpecification: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { color: { $regex: search, $options: 'i' } },
            { width: { $regex: search, $options: 'i' } },
            { height: { $regex: search, $options: 'i' } },
            { depth: { $regex: search, $options: 'i' } },
            { screenSize: { $regex: search, $options: 'i' } }
        ];
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

        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            // Upload images to Cloudinary
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, file.originalname)
            );
            imageUrls = await Promise.all(uploadPromises);
            console.log('Images uploaded to Cloudinary:', imageUrls);
        } else if (req.body.images) {
            imageUrls = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
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
            images: imageUrls,
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
        color, width, height, depth, screenSize, reviews
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
        if (req.body.images) {
            currentImages = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
        } else {
            currentImages = product.images;
        }

        if (req.files && req.files.length > 0) {
            // Upload new images to Cloudinary
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, file.originalname)
            );
            const newImageUrls = await Promise.all(uploadPromises);
            product.images = [...currentImages, ...newImageUrls];
            console.log('New images uploaded to Cloudinary:', newImageUrls);
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

// @desc    Bulk upload products from Excel
// @route   POST /api/products/bulk-upload
// @access  Private/Admin
const bulkUploadProducts = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const Category = require('../models/Category');
    const products = [];
    const errors = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
            const categoryName = row.category || row.Category;
            let category = null;
            if (categoryName) {
                category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
            }

            if (!category) {
                errors.push(`Row ${i + 2}: Category "${categoryName}" not found`);
                continue;
            }

            const productData = {
                user: req.user._id,
                brand: row.brand || row.Brand || '',
                title: row.title || row.Title || row.name || row.Name || '',
                category: category._id,
                description: row.description || row.Description || '',
                price: parseFloat(row.price || row.Price || 0),
                oldPrice: parseFloat(row.oldPrice || row['Old Price'] || 0),
                countInStock: parseInt(row.countInStock || row['Count In Stock'] || row.stock || row.Stock || 0),
                shortDetails: row.shortDetails || row['Short Details'] || '',
                shortSpecification: row.shortSpecification || row['Short Specification'] || '',
                overview: row.overview || row.Overview || '',
                technicalSpecification: row.technicalSpecification || row['Technical Specification'] || '',
                color: row.color || row.Color || '',
                width: row.width || row.Width || '',
                height: row.height || row.Height || '',
                depth: row.depth || row.Depth || '',
                screenSize: row.screenSize || row['Screen Size'] || '',
                images: []
            };

            // Generate slug
            const slug = (productData.title || `product-${Date.now()}-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            productData.slug = slug;

            const product = new Product(productData);
            products.push(product);
        } catch (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
        }
    }

    if (products.length > 0) {
        await Product.insertMany(products);
    }

    res.json({
        message: `Successfully uploaded ${products.length} products`,
        errors: errors.length > 0 ? errors : undefined
    });
});

// @desc    Get search suggestions
// @route   GET /api/products/search/suggestions
// @access  Public
const getSearchSuggestions = asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.json([]);
    }

    const suggestions = await Product.find({
        $or: [
            { title: { $regex: `^${query}`, $options: 'i' } },
            { brand: { $regex: `^${query}`, $options: 'i' } },
            { color: { $regex: `^${query}`, $options: 'i' } }
        ]
    }).select('title brand color').limit(10);

    res.json(suggestions);
});

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    upload,
    uploadExcel,
    getSearchSuggestions,
    bulkUploadProducts
};
