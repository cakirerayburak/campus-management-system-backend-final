const db = require('../models');
const { Op } = require('sequelize');

/**
 * Harf Notu -> Grade Point Dönüşümü
 */
const letterToPoint = {
  'AA': 4.0, 'BA': 3.5, 'BB': 3.0, 'CB': 2.5,
  'CC': 2.0, 'DC': 1.5, 'DD': 1.0, 'FD': 0.5, 'FF': 0.0
};

/**
 * Öğrencinin tüm GPA değerlerini hesaplar:
 * - gpa/cgpa: Genel Not Ortalaması (Cumulative GPA)
 * - semester_gpa: Dönem Ortalaması (Current Semester GPA)
 * - total_credits_earned: Kazanılan toplam kredi
 * - total_ects_earned: Kazanılan toplam AKTS
 * 
 * Tekrar alınan derslerde EN YÜKSEK notu baz alır.
 */
const recalculateGPA = async (studentId, transaction = null) => {
  try {
    // Öğrenci bilgilerini al
    const student = await db.Student.findByPk(studentId, { transaction });
    if (!student) throw new Error('Student not found');

    const currentSemester = student.current_semester;

    // 1. Öğrencinin notu girilmiş tüm derslerini çek
    const enrollments = await db.Enrollment.findAll({
      where: {
        studentId,
        grade_point: { [Op.ne]: null } // Sadece notu olanlar
      },
      include: [{
        model: db.CourseSection,
        as: 'section',
        include: [{ model: db.Course, as: 'course', attributes: ['id', 'credits', 'ects', 'code'] }]
      }],
      transaction
    });

    if (enrollments.length === 0) {
      await db.Student.update(
        { gpa: 0.00, cgpa: 0.00, semester_gpa: 0.00, total_credits_earned: 0, total_ects_earned: 0 },
        { where: { id: studentId }, transaction }
      );
      return { gpa: 0.00, cgpa: 0.00, semester_gpa: 0.00 };
    }

    // 2. Ders Bazlı En Yüksek Notu Bul (Deduplication for CGPA)
    // Aynı courseId'ye sahip birden fazla kayıt varsa, grade_point'i en yüksek olanı al
    const uniqueCourses = {};
    const semesterCourses = {}; // Sadece mevcut dönem dersleri

    let totalCreditsEarned = 0;
    let totalEctsEarned = 0;

    enrollments.forEach(enr => {
      const courseId = enr.section.course.id;
      const currentPoints = enr.grade_point;
      const credits = enr.section.course.credits || 0;
      const ects = enr.section.course.ects || 0;
      const sectionSemester = enr.section.semester;
      const sectionYear = enr.section.year;
      const isPassed = enr.status === 'passed';

      // CGPA için: Tüm dersler (en yüksek not)
      if (!uniqueCourses[courseId]) {
        uniqueCourses[courseId] = {
          credits: credits,
          ects: ects,
          points: currentPoints,
          isPassed: isPassed
        };
      } else {
        // Zaten var, notu karşılaştır
        if (currentPoints > uniqueCourses[courseId].points) {
          uniqueCourses[courseId].points = currentPoints;
          uniqueCourses[courseId].isPassed = isPassed;
        }
      }

      // Semester GPA için: Sadece mevcut dönem + yıl dersleri
      // Şu anki dönem için en son yılın derslerini al
      const currentYear = new Date().getFullYear();
      const isSemesterMatch = (sectionYear === currentYear || sectionYear === currentYear - 1);

      if (isSemesterMatch) {
        const semesterKey = `${courseId}-${sectionSemester}-${sectionYear}`;
        if (!semesterCourses[semesterKey]) {
          semesterCourses[semesterKey] = {
            credits: credits,
            points: currentPoints
          };
        }
      }

      // Kazanılan kredi/ECTS hesabı (sadece geçilen dersler)
      if (isPassed && !uniqueCourses[courseId].counted) {
        totalCreditsEarned += credits;
        totalEctsEarned += ects;
        uniqueCourses[courseId].counted = true;
      }
    });

    // 3. CGPA (Genel Not Ortalaması) Hesapla
    let totalWeightedPoints = 0;
    let totalCredits = 0;

    Object.values(uniqueCourses).forEach(course => {
      totalWeightedPoints += (course.points * course.credits);
      totalCredits += course.credits;
    });

    const cgpa = totalCredits > 0 ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2)) : 0.00;

    // 4. Semester GPA (Dönem Ortalaması) Hesapla
    let semesterWeightedPoints = 0;
    let semesterCredits = 0;

    Object.values(semesterCourses).forEach(course => {
      semesterWeightedPoints += (course.points * course.credits);
      semesterCredits += course.credits;
    });

    const semesterGpa = semesterCredits > 0 ? parseFloat((semesterWeightedPoints / semesterCredits).toFixed(2)) : 0.00;

    // 5. Güncelle
    await db.Student.update(
      {
        gpa: cgpa,
        cgpa: cgpa,
        semester_gpa: semesterGpa,
        total_credits_earned: totalCreditsEarned,
        total_ects_earned: totalEctsEarned
      },
      { where: { id: studentId }, transaction }
    );

    console.log(`✅ Öğrenci (ID: ${studentId}) not ortalamaları güncellendi:`);
    console.log(`   - CGPA (Genel): ${cgpa}`);
    console.log(`   - Dönem Ort.: ${semesterGpa}`);
    console.log(`   - Kazanılan Kredi: ${totalCreditsEarned}`);
    console.log(`   - Kazanılan AKTS: ${totalEctsEarned}`);

    return { gpa: cgpa, cgpa, semester_gpa: semesterGpa, total_credits_earned: totalCreditsEarned };

  } catch (error) {
    console.error("GPA Hesaplama Hatası:", error);
    throw error;
  }
};

/**
 * Belirli bir dönem için dönem ortalamasını hesapla
 * @param {string} studentId 
 * @param {string} semester - 'Fall', 'Spring', 'Summer'
 * @param {number} year - 2024, 2025 vb.
 */
const calculateSemesterGPA = async (studentId, semester, year, transaction = null) => {
  try {
    const enrollments = await db.Enrollment.findAll({
      where: {
        studentId,
        grade_point: { [Op.ne]: null }
      },
      include: [{
        model: db.CourseSection,
        as: 'section',
        where: { semester, year },
        include: [{ model: db.Course, as: 'course', attributes: ['id', 'credits', 'code'] }]
      }],
      transaction
    });

    if (enrollments.length === 0) return 0.00;

    let totalWeightedPoints = 0;
    let totalCredits = 0;

    enrollments.forEach(enr => {
      const credits = enr.section.course.credits || 0;
      totalWeightedPoints += (enr.grade_point * credits);
      totalCredits += credits;
    });

    return totalCredits > 0 ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2)) : 0.00;
  } catch (error) {
    console.error("Dönem GPA Hesaplama Hatası:", error);
    return 0.00;
  }
};

/**
 * Ortalama'dan Harf Notu Hesapla (Vize %40 + Final %60)
 */
const calculateLetterGrade = (midterm, final) => {
  if (midterm === null || midterm === undefined || final === null || final === undefined) {
    return { letter: null, point: null };
  }

  const average = (midterm * 0.4) + (final * 0.6);

  if (average >= 90) return { letter: 'AA', point: 4.0 };
  if (average >= 85) return { letter: 'BA', point: 3.5 };
  if (average >= 80) return { letter: 'BB', point: 3.0 };
  if (average >= 75) return { letter: 'CB', point: 2.5 };
  if (average >= 70) return { letter: 'CC', point: 2.0 };
  if (average >= 65) return { letter: 'DC', point: 1.5 };
  if (average >= 60) return { letter: 'DD', point: 1.0 };
  if (average >= 50) return { letter: 'FD', point: 0.5 };
  return { letter: 'FF', point: 0.0 };
};

/**
 * Öğrenci için dönem bazlı not özeti oluştur
 */
const getGradeSummary = async (studentId) => {
  try {
    const enrollments = await db.Enrollment.findAll({
      where: { studentId },
      include: [{
        model: db.CourseSection,
        as: 'section',
        include: [{ model: db.Course, as: 'course', attributes: ['id', 'code', 'name', 'credits', 'ects'] }]
      }],
      order: [[{ model: db.CourseSection, as: 'section' }, 'year', 'DESC'],
      [{ model: db.CourseSection, as: 'section' }, 'semester', 'DESC']]
    });

    // Dönem bazlı grupla
    const semesters = {};

    enrollments.forEach(enr => {
      const key = `${enr.section.year}-${enr.section.semester}`;
      if (!semesters[key]) {
        semesters[key] = {
          year: enr.section.year,
          semester: enr.section.semester,
          courses: [],
          totalCredits: 0,
          earnedCredits: 0,
          gpa: 0
        };
      }

      semesters[key].courses.push({
        code: enr.section.course.code,
        name: enr.section.course.name,
        credits: enr.section.course.credits,
        midterm: enr.midterm_grade,
        final: enr.final_grade,
        letter: enr.letter_grade,
        point: enr.grade_point,
        status: enr.status
      });

      semesters[key].totalCredits += enr.section.course.credits || 0;
      if (enr.status === 'passed') {
        semesters[key].earnedCredits += enr.section.course.credits || 0;
      }
    });

    // Dönem GPA hesapla
    Object.values(semesters).forEach(sem => {
      let weightedPoints = 0;
      let totalCreds = 0;

      sem.courses.forEach(c => {
        if (c.point !== null) {
          weightedPoints += c.point * c.credits;
          totalCreds += c.credits;
        }
      });

      sem.gpa = totalCreds > 0 ? parseFloat((weightedPoints / totalCreds).toFixed(2)) : 0;
    });

    return Object.values(semesters);
  } catch (error) {
    console.error("Grade Summary Hatası:", error);
    return [];
  }
};

module.exports = {
  recalculateGPA,
  calculateSemesterGPA,
  calculateLetterGrade,
  getGradeSummary,
  letterToPoint
};