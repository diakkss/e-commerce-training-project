const paypal = require('paypal-rest-sdk');
const dotenv = require('dotenv');

dotenv.config();

paypal.configure({
    mode: process.env.PAYPAL_MODE,
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET
});

exports.createPayPalPayment = (orderId, totalAmount) => {
    return new Promise((resolve, reject) => {
        const create_payment_json = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal'
            },
            redirect_urls: {
                return_url: `http://localhost:3000/api/v1/orders/confirm?orderId=${orderId}`,
                cancel_url: `http://localhost:3000/api/v1/orders/cancel`
            },
            transactions: [{
                item_list: {
                    items: [{
                        name: `Order ${orderId}`,
                        sku: '001',
                        price: totalAmount.toFixed(2),
                        currency: 'USD',
                        quantity: 1
                    }]
                },
                amount: {
                    currency: 'USD',
                    total: totalAmount.toFixed(2)
                },
                description: `Payment for order ${orderId}`
            }]
        };

        paypal.payment.create(create_payment_json, (error, payment) => {
            if (error) {
                reject(error);
            } else {
                for (let i = 0; i < payment.links.length; i++) {
                    if (payment.links[i].rel === 'approval_url') {
                        resolve(payment.links[i].href);
                    }
                }
            }
        });
    });
};
