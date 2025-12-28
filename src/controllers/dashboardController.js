const db = require('../models');
const asyncHandler = require('../middleware/async');

// @desc    Dashboard İstatistiklerini Getir
// @route   GET /api/v1/dashboard
// @access  Private
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const role = req.user.role;
  let stats = {};

  // 1. Son 3 Duyuruyu Herkes İçin Çek
  const recentAnnouncements = await db.Announcement.findAll({
    limit: 3,
    order: [['created_at', 'DESC']],
    attributes: ['id', 'title', 'content', 'createdAt', 'priority']
  });

  stats.announcements = recentAnnouncements;

  // 2. Rol Bazlı Veriler
  if (role === 'student') {
    const student = await db.Student.findOne({ where: { userId: req.user.id } });
    if (student) {
      // GPA Bilgileri (Yeni: CGPA, Dönem Ortalaması, Kredi/AKTS)
      stats.gpa = student.gpa || 0;
      stats.cgpa = student.cgpa || student.gpa || 0;
      stats.semester_gpa = student.semester_gpa || 0;
      stats.total_credits_earned = student.total_credits_earned || 0;
      stats.total_ects_earned = student.total_ects_earned || 0;
      stats.current_semester = student.current_semester || 1;
      stats.studentNumber = student.student_number;

      // Kayıtlı Ders Sayısı
      const enrollmentCount = await db.Enrollment.count({
        where: { studentId: student.id, status: 'enrolled' }
      });
      stats.activeCourses = enrollmentCount;

      // Toplam Devamsızlık (Flagged olmayan Attendance kayıtları)
      const attendanceCount = await db.AttendanceRecord.count({
        where: { studentId: student.id }
      });
      stats.totalAttendance = attendanceCount;
    }

  } else if (role === 'faculty') {
    const facultyId = req.user.facultyProfile?.id;
    if (facultyId) {
      // Verdiği Ders Sayısı (Section)
      const sectionCount = await db.CourseSection.count({
        where: { instructorId: facultyId }
      });
      stats.activeSections = sectionCount;

      // Toplam Öğrenci Sayısı
      const totalStudents = await db.Enrollment.count({
        include: [{
          model: db.CourseSection,
          as: 'section',
          where: { instructorId: facultyId }
        }]
      });
      stats.totalStudents = totalStudents;
    }

  } else if (role === 'admin') {
    // Sistem Geneli Sayılar
    stats.totalUsers = await db.User.count();
    stats.totalCourses = await db.Course.count();
    stats.totalStudents = await db.Student.count();
    stats.totalFaculty = await db.Faculty.count();
    stats.totalEvents = await db.Event.count();
  }

  res.status(200).json({
    success: true,
    data: stats
  });
});
