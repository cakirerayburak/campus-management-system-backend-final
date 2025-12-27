const db = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Bildirimleri Listele
// @route   GET /api/v1/notifications
// @access  Private
exports.getNotifications = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { page = 1, limit = 20, category, is_read } = req.query;
    const offset = (page - 1) * limit;

    // Filtre oluştur
    const where = { user_id: userId };
    if (category) where.category = category;
    if (is_read !== undefined) where.is_read = is_read === 'true';

    const { count, rows: notifications } = await db.Notification.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    // Okunmamış sayısı
    const unreadCount = await db.Notification.count({
        where: { user_id: userId, is_read: false }
    });

    res.status(200).json({
        success: true,
        data: {
            notifications,
            unreadCount,
            pagination: {
                total: count,
                page: parseInt(page),
                totalPages: Math.ceil(count / limit),
                limit: parseInt(limit)
            }
        }
    });
});

// @desc    Okunmamış Bildirim Sayısı
// @route   GET /api/v1/notifications/unread-count
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res, next) => {
    const count = await db.Notification.count({
        where: { user_id: req.user.id, is_read: false }
    });

    res.status(200).json({
        success: true,
        data: { unreadCount: count }
    });
});

// @desc    Bildirimi Okundu Olarak İşaretle
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res, next) => {
    const notification = await db.Notification.findOne({
        where: { id: req.params.id, user_id: req.user.id }
    });

    if (!notification) {
        return next(new ErrorResponse('Bildirim bulunamadı.', 404));
    }

    await notification.update({ is_read: true });

    res.status(200).json({
        success: true,
        message: 'Bildirim okundu olarak işaretlendi.',
        data: notification
    });
});

// @desc    Tüm Bildirimleri Okundu Olarak İşaretle
// @route   PUT /api/v1/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = asyncHandler(async (req, res, next) => {
    await db.Notification.update(
        { is_read: true },
        { where: { user_id: req.user.id, is_read: false } }
    );

    res.status(200).json({
        success: true,
        message: 'Tüm bildirimler okundu olarak işaretlendi.'
    });
});

// @desc    Bildirimi Sil
// @route   DELETE /api/v1/notifications/:id
// @access  Private
exports.deleteNotification = asyncHandler(async (req, res, next) => {
    const notification = await db.Notification.findOne({
        where: { id: req.params.id, user_id: req.user.id }
    });

    if (!notification) {
        return next(new ErrorResponse('Bildirim bulunamadı.', 404));
    }

    await notification.destroy();

    res.status(200).json({
        success: true,
        message: 'Bildirim silindi.'
    });
});

// @desc    Tüm Bildirimleri Sil
// @route   DELETE /api/v1/notifications/clear-all
// @access  Private
exports.clearAllNotifications = asyncHandler(async (req, res, next) => {
    await db.Notification.destroy({
        where: { user_id: req.user.id }
    });

    res.status(200).json({
        success: true,
        message: 'Tüm bildirimler silindi.'
    });
});

// @desc    Bildirim Tercihlerini Getir
// @route   GET /api/v1/notifications/preferences
// @access  Private
exports.getPreferences = asyncHandler(async (req, res, next) => {
    let preferences = await db.NotificationPreference.findOne({
        where: { user_id: req.user.id }
    });

    // Yoksa varsayılan tercihlerle oluştur
    if (!preferences) {
        preferences = await db.NotificationPreference.create({
            user_id: req.user.id
        });
    }

    res.status(200).json({
        success: true,
        data: preferences
    });
});

// @desc    Bildirim Tercihlerini Güncelle
// @route   PUT /api/v1/notifications/preferences
// @access  Private
exports.updatePreferences = asyncHandler(async (req, res, next) => {
    const allowedFields = [
        'email_academic', 'email_attendance', 'email_meal', 'email_event', 'email_payment', 'email_system',
        'push_academic', 'push_attendance', 'push_meal', 'push_event', 'push_payment', 'push_system'
    ];

    // Sadece izin verilen alanları al
    const updates = {};
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    let preferences = await db.NotificationPreference.findOne({
        where: { user_id: req.user.id }
    });

    if (!preferences) {
        preferences = await db.NotificationPreference.create({
            user_id: req.user.id,
            ...updates
        });
    } else {
        await preferences.update(updates);
    }

    res.status(200).json({
        success: true,
        message: 'Bildirim tercihleri güncellendi.',
        data: preferences
    });
});

// @desc    Bildirim Oluştur (Internal - diğer servisler tarafından kullanılır)
// @route   POST /api/v1/notifications (Admin only)
// @access  Admin
exports.createNotification = asyncHandler(async (req, res, next) => {
    const { user_id, title, message, category, type, link, metadata } = req.body;

    if (!user_id || !title || !message) {
        return next(new ErrorResponse('user_id, title ve message zorunludur.', 400));
    }

    const notification = await db.Notification.create({
        user_id,
        title,
        message,
        category: category || 'system',
        type: type || 'info',
        link,
        metadata
    });

    res.status(201).json({
        success: true,
        message: 'Bildirim oluşturuldu.',
        data: notification
    });
});

// @desc    Toplu Bildirim Gönder (Admin only)
// @route   POST /api/v1/notifications/broadcast
// @access  Admin
exports.broadcastNotification = asyncHandler(async (req, res, next) => {
    const { title, message, category, type, link, target_role } = req.body;

    if (!title || !message) {
        return next(new ErrorResponse('title ve message zorunludur.', 400));
    }

    // Hedef kullanıcıları bul
    const where = {};
    if (target_role) where.role = target_role;

    const users = await db.User.findAll({
        where,
        attributes: ['id']
    });

    // Her kullanıcı için bildirim oluştur
    const notifications = users.map(user => ({
        user_id: user.id,
        title,
        message,
        category: category || 'system',
        type: type || 'info',
        link
    }));

    await db.Notification.bulkCreate(notifications);

    res.status(201).json({
        success: true,
        message: `${notifications.length} kullanıcıya bildirim gönderildi.`
    });
});
