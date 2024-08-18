const express = require('express');
const router = express.Router();
const { Product } = require('../models/product');
const { User } = require('../models/user');
const authJwt = require('../middleware/jwt');
const verifyRole = require('../middleware/verifyRole');

// Créer un produit (Vendeuse uniquement)
router.post('/', authJwt(), verifyRole(['vendeuse']), async (req, res) => {
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

        res.send(product);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Voir les produits (accessible à tous)
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        if (!products) {
            return res.status(500).json({ message: 'No products found' });
        }
        res.send(products);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Voir les produits par vendeuse
router.get('/vendeuse/:vendeuseId', authJwt(), async (req, res) => {
    try {
        const products = await Product.find({ user: req.params.vendeuseId });
        if (!products) {
            return res.status(500).json({ message: 'No products found for this vendeuse' });
        }
        res.send(products);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

module.exports = router;
