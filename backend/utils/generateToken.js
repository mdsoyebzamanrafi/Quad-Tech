import jwt from 'jsonwebtoken';

const generateToken = (res, userId) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    // Optional: Set JWT as HTTP-Only cookie, or simply return it
    // Here we'll return it for a standard SPA setup
    return token;
};

export default generateToken;
