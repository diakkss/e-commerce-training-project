const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Delivery = require('../models/delivery');
const Order = require('../models/order');
const authJwt = require('../middleware/jwt');
const verifyRole = require('../middleware/verifyRole');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Route pour créer un livreur
router.post('/', [
    authJwt(),
    verifyRole('vendeuse'),
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('phone').isString().notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, phone, email, password } = req.body;
        const vendeuseId = req.auth.userId;

        const hashedPassword = bcrypt.hashSync(password, 10);

        const delivery = new Delivery({
            name,
            phone,
            email,
            passwordHash: hashedPassword,
            vendeuse: vendeuseId,
            role: 'delivery' // Ajout du rôle
        });

        await delivery.save();

        res.status(201).json({ message: 'Delivery created', delivery });
    } catch (error) {
        console.log('Error creating delivery:', error);
        res.status(500).json({ message: 'Error creating delivery', error });
    }
});

// Route de connexion pour les livreurs
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const delivery = await Delivery.findOne({ email });

        if (!delivery) {
            return res.status(404).json({ message: 'Delivery not found' });
        }

        const validPassword = bcrypt.compareSync(password, delivery.passwordHash);
        if (!validPassword) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        const token = jwt.sign(
            { id: delivery._id, role: delivery.role },
            process.env.secret,
            { expiresIn: '1d' }
        );

        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });

        res.status(200).json({ token });
    } catch (error) {
        console.log('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in', error });
    }
});

// Route pour scanner une commande
router.post('/scan/:orderId', [authJwt(), verifyRole('delivery')], async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const deliveryId = req.auth.id;

        // Trouver la commande et le livreur
        const order = await Order.findById(orderId);
        const delivery = await Delivery.findById(deliveryId).populate('vendeuse');

        if (!order || !delivery) {
            return res.status(404).json({ message: 'Order or delivery not found' });
        }

        // Vérifier si le livreur est associé à la vendeuse de la commande
        if (order.vendeuse.toString() !== delivery.vendeuse._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to scan this order' });
        }

        // Marquer la commande comme livrée
        order.status = 'delivered';
        await order.save();

        res.status(200).json({ message: 'Order marked as delivered' });
    } catch (error) {
        console.log('Error scanning order:', error);
        res.status(500).json({ message: 'Error scanning order', error });
    }
});

module.exports = router;
