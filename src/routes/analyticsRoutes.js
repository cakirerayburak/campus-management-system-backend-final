const express = require('express');
const router = express.Router();
const {
    getOverview,
    getRegistrationTrend,
    getAttendanceStats,
    getMealStats,
    getEventStats,
    getAcademicStats,
    getFinancialStats,
    getClassroomUtilization,
    getSystemHealth
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Tüm route'lar authentication gerektirir
router.use(protect);

// Admin ve Faculty erişebilir
router.get('/overview', authorize('admin'), getOverview);
router.get('/registration-trend', authorize('admin'), getRegistrationTrend);
router.get('/attendance', authorize('admin', 'faculty'), getAttendanceStats);
router.get('/meals', authorize('admin'), getMealStats);
router.get('/events', authorize('admin'), getEventStats);
router.get('/academic', authorize('admin', 'faculty'), getAcademicStats);
router.get('/financial', authorize('admin'), getFinancialStats);
router.get('/classroom-utilization', authorize('admin'), getClassroomUtilization);
router.get('/system-health', authorize('admin'), getSystemHealth);

module.exports = router;
