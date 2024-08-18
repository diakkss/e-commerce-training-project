function verifyRole(roles) {
    return (req, res, next) => {
        console.log(req.auth); // Ajouter ce log pour voir ce qui est dans req.auth
        const userRole = req.auth.role;
        if (!roles.includes(userRole)) {
            return res.status(403).json({ message: 'Access forbidden. You do not have permission to access this resource.' });
        }
        next();
    };
}

module.exports = verifyRole