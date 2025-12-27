const db = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Audit Log Listesi
// @route   GET /api/v1/audit-logs
// @access  Admin
exports.getAuditLogs = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 50,
        userId,
        action,
        entityType,
        startDate,
        endDate,
        search
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filtreler
    if (userId) where.user_id = userId;
    if (action) where.action = action;
    if (entityType) where.entity_type = entityType;

    if (startDate && endDate) {
        where.created_at = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };
    } else if (startDate) {
        where.created_at = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
        where.created_at = { [Op.lte]: new Date(endDate) };
    }

    if (search) {
        where[Op.or] = [
            { description: { [Op.iLike]: `%${search}%` } },
            { action: { [Op.iLike]: `%${search}%` } },
            { entity_type: { [Op.iLike]: `%${search}%` } },
            { ip_address: { [Op.iLike]: `%${search}%` } }
        ];
    }

    const { count, rows: logs } = await db.AuditLog.findAndCountAll({
        where,
        include: [{
            model: db.User,
            as: 'user',
            attributes: ['id', 'email', 'name', 'role']
        }],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    res.status(200).json({
        success: true,
        data: {
            logs,
            pagination: {
                total: count,
                page: parseInt(page),
                totalPages: Math.ceil(count / limit),
                limit: parseInt(limit)
            }
        }
    });
});

// @desc    Tek Audit Log Detayı
// @route   GET /api/v1/audit-logs/:id
// @access  Admin
exports.getAuditLogDetail = asyncHandler(async (req, res, next) => {
    const log = await db.AuditLog.findByPk(req.params.id, {
        include: [{
            model: db.User,
            as: 'user',
            attributes: ['id', 'email', 'name', 'role']
        }]
    });

    if (!log) {
        return next(new ErrorResponse('Log bulunamadı.', 404));
    }

    res.status(200).json({
        success: true,
        data: log
    });
});

// @desc    Kullanıcının Audit Logları
// @route   GET /api/v1/audit-logs/user/:userId
// @access  Admin
exports.getUserAuditLogs = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: logs } = await db.AuditLog.findAndCountAll({
        where: { user_id: req.params.userId },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    res.status(200).json({
        success: true,
        data: {
            logs,
            pagination: {
                total: count,
                page: parseInt(page),
                totalPages: Math.ceil(count / limit),
                limit: parseInt(limit)
            }
        }
    });
});

// @desc    Audit Log İstatistikleri
// @route   GET /api/v1/audit-logs/stats
// @access  Admin
exports.getAuditStats = asyncHandler(async (req, res, next) => {
    const today = new Date();
    const sevenDaysAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(today - 24 * 60 * 60 * 1000);

    // Aksiyon bazlı dağılım
    const actionDistribution = await db.AuditLog.findAll({
        attributes: [
            'action',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        group: ['action'],
        order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']]
    });

    // Son 24 saat aktivite
    const last24HoursCount = await db.AuditLog.count({
        where: { created_at: { [Op.gte]: oneDayAgo } }
    });

    // Login istatistikleri
    const loginStats = {
        successful: await db.AuditLog.count({
            where: { action: 'login_success', created_at: { [Op.gte]: sevenDaysAgo } }
        }),
        failed: await db.AuditLog.count({
            where: { action: 'login_failed', created_at: { [Op.gte]: sevenDaysAgo } }
        })
    };

    // En aktif kullanıcılar
    const mostActiveUsers = await db.AuditLog.findAll({
        attributes: [
            'user_id',
            [db.sequelize.fn('COUNT', db.sequelize.col('AuditLog.id')), 'actionCount']
        ],
        include: [{
            model: db.User,
            as: 'user',
            attributes: ['email', 'name', 'role']
        }],
        where: {
            created_at: { [Op.gte]: sevenDaysAgo },
            user_id: { [Op.ne]: null }
        },
        group: ['user_id', 'user.id', 'user.email', 'user.name', 'user.role'],
        order: [[db.sequelize.fn('COUNT', db.sequelize.col('AuditLog.id')), 'DESC']],
        limit: 10
    });

    // Günlük aktivite trend
    const dailyTrend = await db.AuditLog.findAll({
        attributes: [
            [db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'date'],
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        group: [db.sequelize.fn('DATE', db.sequelize.col('created_at'))],
        order: [[db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'ASC']]
    });

    res.status(200).json({
        success: true,
        data: {
            actionDistribution,
            last24HoursCount,
            loginStats,
            mostActiveUsers,
            dailyTrend
        }
    });
});
