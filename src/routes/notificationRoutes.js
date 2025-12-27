const express = require('express');
const router = express.Router();
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getPreferences,
    updatePreferences,
    createNotification,
    broadcastNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Tüm route'lar authentication gerektirir
router.use(protect);

// Kullanıcı route'ları
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllAsRead);
router.delete('/clear-all', clearAllNotifications);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Tekil bildirim işlemleri
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

// Admin route'ları
router.post('/', authorize('admin'), createNotification);
router.post('/broadcast', authorize('admin'), broadcastNotification);

module.exports = router;
