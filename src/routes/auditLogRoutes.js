const express = require('express');
const router = express.Router();
const {
    getAuditLogs,
    getAuditLogDetail,
    getUserAuditLogs,
    getAuditStats
} = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Tüm route'lar admin yetkisi gerektirir
router.use(protect);
router.use(authorize('admin'));

// Routes
router.get('/', getAuditLogs);
router.get('/stats', getAuditStats);
router.get('/user/:userId', getUserAuditLogs);
router.get('/:id', getAuditLogDetail);

module.exports = router;
