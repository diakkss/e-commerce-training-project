const QRCode = require('qrcode');
const path = require('path');

exports.generateQR = async (orderId) => {
    const qrPath = path.join(__dirname, '..', 'qr.png');
    await QRCode.toFile(qrPath, orderId);
    return qrPath;
};
