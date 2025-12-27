const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Analytics Controller
 * Grafik ve istatistik verileri için API endpoint'leri
 */

// @desc    Genel Dashboard İstatistikleri
// @route   GET /api/v1/analytics/overview
// @access  Admin
exports.getOverview = asyncHandler(async (req, res, next) => {
    const stats = {
        users: {
            total: await db.User.count(),
            students: await db.Student.count(),
            faculty: await db.Faculty.count(),
            byRole: await db.User.findAll({
                attributes: ['role', [fn('COUNT', col('id')), 'count']],
                group: ['role']
            })
        },
        academic: {
            courses: await db.Course.count(),
            sections: await db.CourseSection.count(),
            enrollments: await db.Enrollment.count({ where: { status: 'enrolled' } }),
            departments: await db.Department.count()
        },
        attendance: {
            totalSessions: await db.AttendanceSession.count(),
            totalRecords: await db.AttendanceRecord.count(),
            flaggedRecords: await db.AttendanceRecord.count({ where: { is_flagged: true } })
        },
        events: {
            total: await db.Event.count(),
            upcoming: await db.Event.count({ where: { date: { [Op.gte]: new Date() } } }),
            registrations: await db.EventRegistration.count()
        },
        meals: {
            totalReservations: await db.MealReservation.count(),
            todayReservations: await db.MealReservation.count({
                where: {
                    reservation_date: new Date().toISOString().split('T')[0]
                }
            })
        }
    };

    res.status(200).json({ success: true, data: stats });
});

// @desc    Kayıt Trendi (Son 30 gün)
// @route   GET /api/v1/analytics/registration-trend
// @access  Admin
exports.getRegistrationTrend = asyncHandler(async (req, res, next) => {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const registrations = await db.User.findAll({
        attributes: [
            [fn('DATE', col('created_at')), 'date'],
            [fn('COUNT', col('id')), 'count']
        ],
        where: {
            created_at: { [Op.gte]: startDate }
        },
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']]
    });

    res.status(200).json({ success: true, data: registrations });
});

// @desc    Yoklama İstatistikleri
// @route   GET /api/v1/analytics/attendance
// @access  Admin, Faculty
exports.getAttendanceStats = asyncHandler(async (req, res, next) => {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
        where.created_at = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    // Genel istatistikler
    const stats = {
        total: await db.AttendanceRecord.count({ where }),
        present: await db.AttendanceRecord.count({ where: { ...where, is_flagged: false } }),
        flagged: await db.AttendanceRecord.count({ where: { ...where, is_flagged: true } })
    };

    // Günlük dağılım (Son 7 gün)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyDistribution = await db.AttendanceRecord.findAll({
        attributes: [
            [fn('DATE', col('created_at')), 'date'],
            [fn('COUNT', col('id')), 'count']
        ],
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']]
    });

    // Şüpheli kayıt sebepleri
    const flagReasons = await db.AttendanceRecord.findAll({
        attributes: ['flag_reason'],
        where: { is_flagged: true, flag_reason: { [Op.ne]: null } },
        limit: 100
    });

    // Flag nedenlerini say
    const flagReasonCounts = {};
    flagReasons.forEach(record => {
        const reasons = record.flag_reason?.split(',') || [];
        reasons.forEach(reason => {
            const trimmed = reason.trim();
            if (trimmed) {
                flagReasonCounts[trimmed] = (flagReasonCounts[trimmed] || 0) + 1;
            }
        });
    });

    res.status(200).json({
        success: true,
        data: {
            stats,
            dailyDistribution,
            flagReasonCounts
        }
    });
});

// @desc    Yemek Kullanım İstatistikleri
// @route   GET /api/v1/analytics/meals
// @access  Admin
exports.getMealStats = asyncHandler(async (req, res, next) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    const startDateStr = startOfWeek.toISOString().split('T')[0];

    // Öğün bazlı dağılım
    const mealTypeDistribution = await db.MealReservation.findAll({
        attributes: [
            'meal_type',
            [fn('COUNT', col('id')), 'count']
        ],
        where: { reservation_date: { [Op.gte]: startDateStr } },
        group: ['meal_type']
    });

    // Günlük rezervasyon trendi
    const dailyTrend = await db.MealReservation.findAll({
        attributes: [
            'reservation_date',
            [fn('COUNT', col('id')), 'count']
        ],
        where: { reservation_date: { [Op.gte]: startDateStr } },
        group: ['reservation_date'],
        order: [['reservation_date', 'ASC']]
    });

    // Kullanım durumu
    const usageStats = {
        total: await db.MealReservation.count({ where: { reservation_date: { [Op.gte]: startDateStr } } }),
        used: await db.MealReservation.count({ where: { reservation_date: { [Op.gte]: startDateStr }, status: 'used' } }),
        cancelled: await db.MealReservation.count({ where: { reservation_date: { [Op.gte]: startDateStr }, status: 'cancelled' } }),
        pending: await db.MealReservation.count({ where: { reservation_date: { [Op.gte]: startDateStr }, status: 'reserved' } })
    };

    res.status(200).json({
        success: true,
        data: {
            mealTypeDistribution,
            dailyTrend,
            usageStats
        }
    });
});

// @desc    Etkinlik İstatistikleri
// @route   GET /api/v1/analytics/events
// @access  Admin
exports.getEventStats = asyncHandler(async (req, res, next) => {
    // Kategori bazlı dağılım
    const categoryDistribution = await db.Event.findAll({
        attributes: [
            'category',
            [fn('COUNT', col('id')), 'count']
        ],
        group: ['category']
    });

    // Katılım oranları
    const events = await db.Event.findAll({
        attributes: ['id', 'title', 'capacity'],
        include: [{
            model: db.EventRegistration,
            as: 'registrations',
            attributes: ['id', 'attended']
        }],
        limit: 10,
        order: [['date', 'DESC']]
    });

    const participationRates = events.map(event => ({
        id: event.id,
        title: event.title,
        capacity: event.capacity,
        registered: event.registrations?.length || 0,
        attended: event.registrations?.filter(r => r.attended).length || 0,
        fillRate: event.capacity ? ((event.registrations?.length || 0) / event.capacity * 100).toFixed(1) : 0
    }));

    res.status(200).json({
        success: true,
        data: {
            categoryDistribution,
            participationRates
        }
    });
});

// @desc    Akademik Performans İstatistikleri
// @route   GET /api/v1/analytics/academic
// @access  Admin, Faculty
exports.getAcademicStats = asyncHandler(async (req, res, next) => {
    // GPA Dağılımı
    const gpaDistribution = await db.Student.findAll({
        attributes: [
            [literal('CASE WHEN gpa >= 3.5 THEN \'3.5+\' WHEN gpa >= 3.0 THEN \'3.0-3.5\' WHEN gpa >= 2.5 THEN \'2.5-3.0\' WHEN gpa >= 2.0 THEN \'2.0-2.5\' ELSE \'< 2.0\' END'), 'range'],
            [fn('COUNT', col('id')), 'count']
        ],
        group: [literal('CASE WHEN gpa >= 3.5 THEN \'3.5+\' WHEN gpa >= 3.0 THEN \'3.0-3.5\' WHEN gpa >= 2.5 THEN \'2.5-3.0\' WHEN gpa >= 2.0 THEN \'2.0-2.5\' ELSE \'< 2.0\' END')]
    });

    // Kayıt durumu
    const enrollmentStatus = await db.Enrollment.findAll({
        attributes: [
            'status',
            [fn('COUNT', col('id')), 'count']
        ],
        group: ['status']
    });

    // En popüler dersler
    const popularCourses = await db.Enrollment.findAll({
        attributes: [
            [fn('COUNT', col('Enrollment.id')), 'enrollmentCount']
        ],
        include: [{
            model: db.CourseSection,
            as: 'section',
            attributes: ['id'],
            include: [{
                model: db.Course,
                as: 'course',
                attributes: ['id', 'code', 'name']
            }]
        }],
        group: ['section.id', 'section.course.id', 'section.course.code', 'section.course.name'],
        order: [[fn('COUNT', col('Enrollment.id')), 'DESC']],
        limit: 10
    });

    res.status(200).json({
        success: true,
        data: {
            gpaDistribution,
            enrollmentStatus,
            popularCourses
        }
    });
});

// @desc    Cüzdan/Finansal İstatistikler
// @route   GET /api/v1/analytics/financial
// @access  Admin
exports.getFinancialStats = asyncHandler(async (req, res, next) => {
    // Toplam bakiye
    const totalBalance = await db.Wallet.sum('balance');

    res.status(200).json({
        success: true,
        data: {
            totalBalance: totalBalance || 0
        }
    });
});

// @desc    Derslik Kullanım Oranları
// @route   GET /api/v1/analytics/classroom-utilization
// @access  Admin
exports.getClassroomUtilization = asyncHandler(async (req, res, next) => {
    // Derslik bazlı ders sayısı
    const classroomUsage = await db.Schedule.findAll({
        attributes: [
            'classroom_id',
            [fn('COUNT', col('Schedule.id')), 'scheduleCount']
        ],
        include: [{
            model: db.Classroom,
            as: 'classroom',
            attributes: ['id', 'code', 'building', 'capacity']
        }],
        group: ['classroom_id', 'classroom.id', 'classroom.code', 'classroom.building', 'classroom.capacity']
    });

    // Gün bazlı kullanım
    const dayDistribution = await db.Schedule.findAll({
        attributes: [
            'day_of_week',
            [fn('COUNT', col('id')), 'count']
        ],
        group: ['day_of_week'],
        order: [['day_of_week', 'ASC']]
    });

    res.status(200).json({
        success: true,
        data: {
            classroomUsage,
            dayDistribution
        }
    });
});

// @desc    Sistem Sağlık Durumu
// @route   GET /api/v1/analytics/system-health
// @access  Admin
exports.getSystemHealth = asyncHandler(async (req, res, next) => {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    const health = {
        database: 'healthy',
        lastHourActivity: {
            attendanceRecords: await db.AttendanceRecord.count({ where: { created_at: { [Op.gte]: oneHourAgo } } })
        },
        last24HoursActivity: {
            newUsers: await db.User.count({ where: { created_at: { [Op.gte]: oneDayAgo } } }),
            newEnrollments: await db.Enrollment.count({ where: { created_at: { [Op.gte]: oneDayAgo } } }),
            // EventRegistration uses registration_date instead of created_at
            eventRegistrations: await db.EventRegistration.count({ where: { registration_date: { [Op.gte]: oneDayAgo } } }),
            // MealReservation uses reservation_date (DATEONLY)
            mealReservations: await db.MealReservation.count({ where: { reservation_date: todayStr } })
        },
        notifications: {
            total: await db.Notification?.count() || 0,
            unread: await db.Notification?.count({ where: { is_read: false } }) || 0
        }
    };

    res.status(200).json({
        success: true,
        data: health,
        timestamp: now
    });
});
