const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    vendeuse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        default: 'delivery'
    }
});

const Delivery = mongoose.model('Delivery', deliverySchema);
module.exports = Delivery;
