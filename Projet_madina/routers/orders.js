const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { createPayPalPayment } = require('../helpers/paymentService');
const { generateQR } = require('../helpers/qrService');
const { sendOrderEmail } = require('../helpers/emailService');
const authJwt = require('../middleware/jwt');
const { body, validationResult } = require('express-validator');
const paypal = require('paypal-rest-sdk');

// Route pour créer une commande
router.post('/', [
    authJwt(),
    body('products').isArray().withMessage('Products must be an array').notEmpty().withMessage('Products are required'),
    body('totalAmount').isFloat({ gt: 0 }).withMessage('Total amount must be a positive number'),
    body('vendeuseId').isMongoId().withMessage('Invalid vendeuse ID')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { products, totalAmount, vendeuseId } = req.body;
        const consumerId = req.auth.userId;

        const order = new Order({
            products,
            consumer: consumerId,
            vendeuse: vendeuseId,
            totalAmount
        });

        await order.save();

        const paymentLink = await createPayPalPayment(order._id, totalAmount);

        res.cookie('token', req.cookies.token, { httpOnly: true, secure: false, maxAge: 20 * 60 * 60 * 1000 });

        res.status(201).json({ message: 'Order placed', paymentLink });
    } catch (error) {
        console.log('Error placing order:', error);
        res.status(500).json({ message: 'Error placing order', error });
    }
});

// Route pour confirmer une commande
router.get('/confirm', authJwt(), async (req, res) => {
    const { paymentId, PayerID, token, orderId } = req.query;

    try {
        // Vérifiez la présence du token dans les cookies
        if (!req.cookies.token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Récupérez la commande et les détails de l'utilisateur
        const order = await Order.findById(orderId).populate('consumer');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Vérifiez que l'utilisateur a accès à cette commande
        if (order.consumer._id.toString() !== req.auth.userId) {
            return res.status(403).json({ message: 'The user is not authorized' });
        }

        // Confirmation du paiement avec PayPal
        const execute_payment_json = {
            payer_id: PayerID,
            transactions: [{
                amount: {
                    currency: 'USD',
                    total: order.totalAmount.toString()
                }
            }]
        };

        paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
            if (error) {
                console.log('Error confirming payment:', error);
                return res.status(500).json({ message: 'Error confirming payment', error });
            }

            // Mise à jour du statut de la commande
            order.paymentStatus = 'Paid';
            await order.save();

            // Génération du QR code et envoi de l'email
            const qrCode = await generateQR(order._id.toString());
            const userEmail = order.consumer.email;
            await sendOrderEmail(userEmail, qrCode);

            res.status(200).json({ message: 'Payment confirmed and email sent', qrCode });
        });
    } catch (error) {
        console.log('Error confirming payment:', error);
        res.status(500).json({ message: 'Error confirming payment', error });
    }
});

module.exports = router;
