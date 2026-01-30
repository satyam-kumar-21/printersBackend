const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
        
        const products = await Product.find({ slug: { $exists: false } });
        console.log(`Found ${products.length} products without slugs.`);
        
        for (const product of products) {
            product.slug = product.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");
            await product.save();
            console.log(`Slug generated for: ${product.title}`);
        }
        
        console.log('All products updated.');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

connectDB();
