const express = require('express');
const router = express.Router();
const { Product } = require('../models/product');
const { User } = require('../models/user');
const authJwt = require('../middleware/jwt');
const verifyRole = require('../middleware/verifyRole');
const { body, validationResult } = require('express-validator');
const NodeCache = require('node-cache');
const productCache = new NodeCache({ stdTTL: 600 }); // Cache de 10 minutes

// Créer un produit (Vendeuse uniquement)
router.post('/', [
    authJwt(),
    verifyRole(['vendeuse']),
    body('name').notEmpty().withMessage('Product name is required'),
    body('description').notEmpty().withMessage('Product description is required'),
    body('category').notEmpty().withMessage('Product category is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Product price must be a positive number'),
    body('countInStock').isInt({ gt: -1 }).withMessage('Count in stock must be a non-negative integer'),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
    body('numReviews').optional().isInt({ min: 0 }).withMessage('Number of reviews must be a non-negative integer')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.auth.userId);
        if (!user || user.role !== 'vendeuse') {
            return res.status(403).json({ message: 'Access forbidden' });
        }

        let product = new Product({
            name: req.body.name,
            description: req.body.description,
            image: req.body.image,
            price: req.body.price,
            category: req.body.category,
            countInStock: req.body.countInStock,
            rating: req.body.rating,
            numReviews: req.body.numReviews,
            isFeatured: req.body.isFeatured,
            user: req.auth.userId
        });

        product = await product.save();

        if (!product) {
            return res.status(500).json({ message: 'The product cannot be created' });
        }

        // Invalider le cache après création
        productCache.del('all_products');

        res.status(201).send(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Voir les produits (accessible à tous)
router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `products_page_${page}_limit_${limit}`;

    try {
        const cachedProducts = productCache.get(cacheKey);

        if (cachedProducts) {
            return res.status(200).send(cachedProducts);
        }

        const products = await Product.find()
            .skip((page - 1) * limit)
            .limit(limit);

        if (!products.length) {
            return res.status(404).json({ message: 'No products found' });
        }

        productCache.set(cacheKey, products);
        res.status(200).send(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Voir les produits par vendeuse
router.get('/vendeuse/:vendeuseId', authJwt(), async (req, res) => {
    try {
        const products = await Product.find({ user: req.params.vendeuseId });

        if (!products.length) {
            return res.status(404).json({ message: 'No products found for this vendeuse' });
        }

        res.status(200).send(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
