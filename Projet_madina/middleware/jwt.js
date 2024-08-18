const { expressjwt: jwt } = require('express-jwt');

function authJwt() {
    const secret = process.env.secret;
    const api = process.env.API_REST;

    return jwt({
        secret,
        algorithms: ['HS256'],
        requestProperty: 'auth',
        getToken: (req) => {
            // Vérifier les cookies pour le token
            if (req.cookies && req.cookies.token) {
                return req.cookies.token;
            }
            return null;
        }
    }).unless({
        path: [
            { url: /\/api\/v1\/products(.*)/, methods: ['GET', 'OPTIONS'] },
            `${api}/users/login`,
            `${api}/users/register`,
        ]
    });
}

module.exports = authJwt;
