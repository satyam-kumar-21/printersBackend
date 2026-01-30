const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
    name: { type: String, required: true },
    avatar: { type: String }, // For profile picture
    rating: { type: Number, required: true, default: 5 },
    comment: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for admin-added reviews
}, { timestamps: true });

const productSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    brand: { type: String, required: true },
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    category: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Category' },
    description: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    oldPrice: { type: Number, default: 0 },
    countInStock: { type: Number, required: true, default: 0 },
    // Rich Content
    shortDetails: { type: String },
    shortSpecification: { type: String },
    overview: { type: String },
    technicalSpecification: { type: String },

    // Specs
    color: { type: String },
    width: { type: String },
    height: { type: String },
    depth: { type: String },
    screenSize: { type: String },

    rating: { type: Number, required: true, default: 0 },
    numReviews: { type: Number, required: true, default: 0 },
    reviews: [reviewSchema],
    images: [String],
    sales: { type: Number, default: 0 },
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
