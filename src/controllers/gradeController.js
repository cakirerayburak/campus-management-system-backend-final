const db = require('../models');
const Enrollment = db.Enrollment;
const CourseSection = db.CourseSection;
const Student = db.Student;
const Course = db.Course;
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const pdfService = require('../utils/pdfService');
const { recalculateGPA, calculateLetterGrade, getGradeSummary, calculateSemesterGPA } = require('../utils/gradeHelper');

// @desc    Not Girişi Yap (Hoca)
// @route   PUT /api/v1/grades/:enrollmentId
// @access  Faculty (dersin hocası) veya Admin
exports.updateGrade = asyncHandler(async (req, res, next) => {
  const { midterm_grade, final_grade } = req.body;
  const { enrollmentId } = req.params;
  const instructorId = req.user.facultyProfile?.id;

  let enrollment = await Enrollment.findByPk(enrollmentId, {
    include: [{ model: CourseSection, as: 'section' }]
  });

  if (!enrollment) return next(new ErrorResponse('Kayıt bulunamadı.', 404));

  // Yetki kontrolü
  if (req.user.role === 'faculty' && enrollment.section.instructorId !== instructorId) {
    return next(new ErrorResponse('Bu dersin notunu girme yetkiniz yok.', 403));
  }

  // Notları güncelle
  if (midterm_grade !== undefined) enrollment.midterm_grade = midterm_grade;
  if (final_grade !== undefined) enrollment.final_grade = final_grade;

  // Harf notu ve durum hesapla
  if (enrollment.midterm_grade !== null && enrollment.final_grade !== null) {
    const result = calculateLetterGrade(enrollment.midterm_grade, enrollment.final_grade);
    enrollment.letter_grade = result.letter;
    enrollment.grade_point = result.point;

    if (result.letter === 'FF' || result.letter === 'FD') {
      enrollment.status = 'failed';
    } else {
      enrollment.status = 'passed';
    }
  }

  await enrollment.save();

  // GPA'ları yeniden hesapla (CGPA + Dönem Ortalaması)
  const gpaResult = await recalculateGPA(enrollment.studentId);

  res.status(200).json({
    success: true,
    message: 'Not güncellendi ve ortalamalar hesaplandı.',
    data: {
      enrollment,
      gpa: gpaResult.gpa,
      cgpa: gpaResult.cgpa,
      semester_gpa: gpaResult.semester_gpa
    }
  });
});

// @desc    Öğrenci Notlarını Getir
// @route   GET /api/v1/grades/my-grades
// @access  Student
exports.getMyGrades = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({ where: { userId: req.user.id } });

  if (!student) {
    return next(new ErrorResponse('Öğrenci profili bulunamadı.', 404));
  }

  const grades = await Enrollment.findAll({
    where: { studentId: student.id },
    include: [{
      model: CourseSection,
      as: 'section',
      include: [{
        model: Course,
        as: 'course',
        attributes: ['code', 'name', 'credits', 'ects']
      }]
    }],
    order: [[{ model: CourseSection, as: 'section' }, 'year', 'DESC'],
    [{ model: CourseSection, as: 'section' }, 'semester', 'DESC']]
  });

  res.status(200).json({
    success: true,
    data: grades,
    summary: {
      gpa: student.gpa,
      cgpa: student.cgpa,
      semester_gpa: student.semester_gpa,
      total_credits_earned: student.total_credits_earned,
      total_ects_earned: student.total_ects_earned,
      current_semester: student.current_semester
    }
  });
});

// @desc    Dönem Bazlı Not Özeti Getir
// @route   GET /api/v1/grades/summary
// @access  Student
exports.getGradeSummary = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({ where: { userId: req.user.id } });

  if (!student) {
    return next(new ErrorResponse('Öğrenci profili bulunamadı.', 404));
  }

  const summary = await getGradeSummary(student.id);

  res.status(200).json({
    success: true,
    data: {
      semesters: summary,
      overall: {
        gpa: student.gpa,
        cgpa: student.cgpa,
        semester_gpa: student.semester_gpa,
        total_credits_earned: student.total_credits_earned,
        total_ects_earned: student.total_ects_earned
      }
    }
  });
});

// @desc    Belirli Dönem Ortalamasını Getir
// @route   GET /api/v1/grades/semester/:semester/:year
// @access  Student
exports.getSemesterGPA = asyncHandler(async (req, res, next) => {
  const { semester, year } = req.params;
  const student = await Student.findOne({ where: { userId: req.user.id } });

  if (!student) {
    return next(new ErrorResponse('Öğrenci profili bulunamadı.', 404));
  }

  const semesterGpa = await calculateSemesterGPA(student.id, semester, parseInt(year));

  const grades = await Enrollment.findAll({
    where: { studentId: student.id },
    include: [{
      model: CourseSection,
      as: 'section',
      where: { semester, year: parseInt(year) },
      include: [{ model: Course, as: 'course', attributes: ['code', 'name', 'credits'] }]
    }]
  });

  res.status(200).json({
    success: true,
    data: {
      semester,
      year: parseInt(year),
      semester_gpa: semesterGpa,
      courses: grades
    }
  });
});

// @desc    Transkript PDF İndir
// @route   GET /api/v1/grades/transcript/pdf
// @access  Student
exports.downloadTranscript = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({
    where: { userId: req.user.id },
    include: [
      { model: db.User, as: 'user', attributes: ['name'] },
      { model: db.Department, as: 'department', attributes: ['name'] }
    ]
  });

  if (!student) {
    return next(new ErrorResponse('Öğrenci profili bulunamadı.', 404));
  }

  const enrollments = await Enrollment.findAll({
    where: { studentId: student.id },
    include: [{
      model: CourseSection,
      as: 'section',
      include: [{ model: Course, as: 'course', attributes: ['code', 'name', 'credits', 'ects'] }]
    }],
    order: [[{ model: CourseSection, as: 'section' }, 'year', 'ASC'],
    [{ model: CourseSection, as: 'section' }, 'semester', 'ASC']]
  });

  // Dosya isminde boşluk veya Türkçe karakter olmaması daha güvenlidir
  const safeFilename = `Transkript-${student.student_number}.pdf`;

  try {
    // PDF'i oluştur ve Buffer olarak al
    const pdfBuffer = await pdfService.buildTranscript(student, enrollments);

    // Headerları ayarla
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': pdfBuffer.length
    });

    // Veriyi gönder
    res.send(pdfBuffer);

  } catch (error) {
    console.error("PDF Oluşturma Hatası:", error);
    return next(new ErrorResponse('PDF oluşturulurken bir hata meydana geldi.', 500));
  }
});

// @desc    Tüm öğrenci notlarını getir (Admin)
// @route   GET /api/v1/grades/all
// @access  Admin
exports.getAllGrades = asyncHandler(async (req, res, next) => {
  const { semester, year, course_id } = req.query;

  const whereClause = {};
  const sectionWhere = {};

  if (semester) sectionWhere.semester = semester;
  if (year) sectionWhere.year = parseInt(year);
  if (course_id) sectionWhere.courseId = course_id;

  const enrollments = await Enrollment.findAll({
    where: whereClause,
    include: [
      {
        model: CourseSection,
        as: 'section',
        where: Object.keys(sectionWhere).length > 0 ? sectionWhere : undefined,
        include: [{ model: Course, as: 'course', attributes: ['code', 'name', 'credits'] }]
      },
      {
        model: Student,
        as: 'student',
        include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }]
      }
    ],
    order: [[{ model: CourseSection, as: 'section' }, 'year', 'DESC']]
  });

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments
  });
});