const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const Delivery = require('../models/delivery');
const Order = require('../models/order');
const authJwt = require('../middleware/jwt');
const verifyRole = require('../middleware/verifyRole');

// Create a new user (public)
router.post('/register', async (req, res) => {
    try {
        let user = new User({
            name: req.body.name,
            email: req.body.email,
            passwordHash: bcrypt.hashSync(req.body.password, 10),
            phone: req.body.phone,
            street: req.body.street,
            apartment: req.body.apartment,
            city: req.body.city,
            zip: req.body.zip,
            country: req.body.country,
            role: req.body.role
        });

        user = await user.save();

        if (!user)
            return res.status(500).send('The user cannot be created');

        res.send(user);
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).send('Internal Server Error');
    }
});

// User login (public)
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        const secret = process.env.secret;

        if (!user) {
            return res.status(500).json({ message: 'The user not found' });
        }

        if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
            const token = jwt.sign(
                {
                    userId: user.id,
                    role: user.role
                },
                secret,
                { expiresIn: '1d' }
            );
            // Stocker le token dans un cookie sécurisé
            res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 20 * 60 * 60 * 1000 });
            // Envoyer le token aussi dans la réponse
            res.status(200).send({ user: user.email, token: token });
        } else {
            res.status(400).send('Password is wrong');
        }
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Get all users (admin only)
router.get('/', authJwt(), verifyRole(['admin']), async (req, res) => {
    try {
        const userList = await User.find().select('-passwordHash');
        if (!userList) {
            return res.status(500).json({ success: false });
        }
        res.send(userList);
    } catch (err) {
        res.status(500).json({ success: false, error: err });
    }
});

// Get user by ID (protected)
router.get('/:id', authJwt(), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');
        if (!user) {
            return res.status(500).json({ message: 'The user with the given ID was not found.' });
        }
        res.status(200).send(user);
    } catch (err) {
        res.status(500).json({ success: false, error: err });
    }
});

// Get profile (protected)
router.get('/profile', authJwt(), async (req, res) => {
    try {
        const user = await User.findById(req.auth.userId).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.log('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching profile', error });
    }
});

// Update profile (protected)
router.put('/profile', authJwt(), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.auth.userId, req.body, { new: true }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.log('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile', error });
    }
});

// Change password (protected)
router.put('/password', authJwt(), async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.auth.userId);

        if (!user || !bcrypt.compareSync(oldPassword, user.passwordHash)) {
            return res.status(400).json({ message: 'Incorrect old password' });
        }

        user.passwordHash = bcrypt.hashSync(newPassword, 10);
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.log('Error changing password:', error);
        res.status(500).json({ message: 'Error changing password', error });
    }
});

// Get user orders (protected)
router.get('/orders', authJwt(), async (req, res) => {
    try {
        const orders = await Order.find({ consumer: req.auth.userId });
        res.status(200).json(orders);
    } catch (error) {
        console.log('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders', error });
    }
});

// Get order details (protected)
router.get('/orders/:orderId', authJwt(), async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).populate('products');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.log('Error fetching order details:', error);
        res.status(500).json({ message: 'Error fetching order details', error });
    }
});

// Add a new delivery (for vendors only)
router.post('/deliveries', [authJwt(), verifyRole('vendeuse')], async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        const vendeuseId = req.auth.userId;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const delivery = new Delivery({
            name,
            phone,
            email,
            passwordHash: hashedPassword,
            vendeuse: vendeuseId,
            role: 'delivery'
        });

        await delivery.save();

        res.status(201).json({ message: 'Delivery created', delivery });
    } catch (error) {
        console.log('Error creating delivery:', error);
        res.status(500).json({ message: 'Error creating delivery', error });
    }
});

// Login as delivery (public)
router.post('/deliveries/login', async (req, res) => {
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

module.exports = router;
