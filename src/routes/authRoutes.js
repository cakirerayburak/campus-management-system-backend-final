const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const validate = require('../middleware/validationMiddleware');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');

// Auth için özel rate limiter - Brute force koruması
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: process.env.NODE_ENV === 'test' ? 10000 : 10, // Test ortamında yüksek limit
    message: {
        success: false,
        message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' // Test ortamında tamamen atla
});

// Daha sıkı rate limiter - şifre sıfırlama için
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: process.env.NODE_ENV === 'test' ? 10000 : 5, // Test ortamında yüksek limit
    message: {
        success: false,
        message: 'Çok fazla şifre sıfırlama isteği. Lütfen 1 saat sonra tekrar deneyin.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' // Test ortamında tamamen atla
});

// Register için rate limiter
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: process.env.NODE_ENV === 'test' ? 10000 : 5, // Test ortamında yüksek limit
    message: {
        success: false,
        message: 'Çok fazla kayıt denemesi. Lütfen 1 saat sonra tekrar deneyin.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' // Test ortamında tamamen atla
});

// Routes
router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.put('/reset-password/:resettoken', passwordResetLimiter, authController.resetPassword);

module.exports = router;