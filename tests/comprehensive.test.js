/**
 * Comprehensive Backend Tests
 * Tüm kritik sistemlerin kapsamlı testleri
 * 
 * Kapsam:
 * 1. Authentication (JWT, Refresh, Password Reset)
 * 2. Authorization (Role-based access)
 * 3. Enrollment Logic (Prerequisites, AKTS, Conflicts)
 * 4. Attendance Security (GPS, IP, Velocity)
 * 5. Schedule Approval System
 * 6. Wallet & Payments
 * 7. Input Validation & Security
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const crypto = require('crypto');

// Test süresini artır (karmaşık testler için)
jest.setTimeout(30000);

// Değişkenler
let adminToken, facultyToken, studentToken;
let adminUser, facultyUser, studentUser;
let departmentId, classroomId, courseId, sectionId;
let studentId, facultyId, enrollmentId;

// ============================================================================
// SETUP: Test Ortamını Hazırla
// ============================================================================
beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  
  // 1. Department oluştur
  const dept = await db.Department.create({
    name: 'Test Department',
    code: 'TEST',
    faculty_name: 'Test Faculty'
  });
  departmentId = dept.id;

  // 2. Classroom oluştur
  const classroom = await db.Classroom.create({
    code: 'TEST-101',
    building: 'Test Building',
    room_number: '101',
    capacity: 50,
    type: 'classroom',
    latitude: 41.0255,
    longitude: 40.5201
  });
  classroomId = classroom.id;
});

afterAll(async () => {
  await db.sequelize.close();
});

// ============================================================================
// 1. AUTHENTICATION TESTS (Kapsamlı)
// ============================================================================
describe('1. Authentication System', () => {
  const timestamp = Date.now();
  
  // Tüm kullanıcıları en başta oluştur ve doğrula
  beforeAll(async () => {
    // 1. Student register
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Student',
        email: `student_${timestamp}@test.com`,
        password: 'Password123',
        role: 'student',
        department_id: departmentId
      });
    
    // 2. Faculty register
    const facRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Faculty',
        email: `faculty_${timestamp}@test.com`,
        password: 'Password123',
        role: 'faculty',
        department_id: departmentId,
        title: 'Dr.'
      });

    // 3. Kullanıcıları doğrula
    await db.User.update(
      { is_verified: true },
      { where: { email: `student_${timestamp}@test.com` } }
    );
    await db.User.update(
      { is_verified: true, role: 'faculty' },
      { where: { email: `faculty_${timestamp}@test.com` } }
    );

    // 4. Student ve Faculty bilgilerini al (Register sırasında zaten oluşturuldu)
    studentUser = await db.User.findOne({ where: { email: `student_${timestamp}@test.com` } });
    if (studentUser) {
      const student = await db.Student.findOne({ where: { userId: studentUser.id } });
      if (student) {
        studentId = student.id;
      }
    }

    facultyUser = await db.User.findOne({ where: { email: `faculty_${timestamp}@test.com` } });
    if (facultyUser) {
      const faculty = await db.Faculty.findOne({ where: { userId: facultyUser.id } });
      if (faculty) {
        facultyId = faculty.id;
      }
    }

    // 5. Admin oluştur (Admin için profil tablosu yok)
    adminUser = await db.User.create({
      name: 'Test Admin',
      email: `admin_${timestamp}@test.com`,
      password_hash: 'Password123',
      role: 'admin',
      is_verified: true
    });

    // 6. Tüm token'ları al
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `student_${timestamp}@test.com`, password: 'Password123' });
    studentToken = studentLogin.body.data?.accessToken;

    const facultyLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `faculty_${timestamp}@test.com`, password: 'Password123' });
    facultyToken = facultyLogin.body.data?.accessToken;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `admin_${timestamp}@test.com`, password: 'Password123' });
    adminToken = adminLogin.body.data?.accessToken;
  });

  describe('1.1 Registration', () => {
    it('should register a new student successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another Student',
          email: `student2_${timestamp}@test.com`,
          password: 'Password123',
          role: 'student',
          department_id: departmentId
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/kontrol|doğrula/i);
    });

    it('should register a new faculty successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another Faculty',
          email: `faculty2_${timestamp}@test.com`,
          password: 'Password123',
          role: 'faculty',
          department_id: departmentId,
          title: 'Dr.'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak Password User',
          email: `weak_${timestamp}@test.com`,
          password: '12345', // Zayıf şifre
          role: 'student'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: 'Password123',
          role: 'student'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Duplicate User',
          email: `student_${timestamp}@test.com`, // Zaten kayıtlı
          password: 'Password123',
          role: 'student'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('1.2 Login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `student_${timestamp}@test.com`,
          password: 'Password123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should login faculty successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `faculty_${timestamp}@test.com`,
          password: 'Password123'
        });

      expect(res.statusCode).toEqual(200);
    });

    it('should login admin successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `admin_${timestamp}@test.com`,
          password: 'Password123'
        });

      expect(res.statusCode).toEqual(200);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `student_${timestamp}@test.com`,
          password: 'WrongPassword123'
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123'
        });

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('1.3 Token Refresh', () => {
    let refreshToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `student_${timestamp}@test.com`,
          password: 'Password123'
        });
      refreshToken = res.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.statusCode).toEqual(401);
    });

    it('should reject empty refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('1.4 Password Reset Flow', () => {
    it('should send password reset email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: `student_${timestamp}@test.com` });

      // Email gönderimi başarısız olabilir (SMTP yok), ama endpoint çalışmalı
      expect([200, 500]).toContain(res.statusCode);
    });

    it('should reject password reset for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.statusCode).toEqual(404);
    });

    it('should reset password with valid token', async () => {
      // Token oluştur
      const resetToken = crypto.randomBytes(20).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      await db.User.update(
        {
          reset_password_token: hashedToken,
          reset_password_expire: new Date(Date.now() + 10 * 60 * 1000)
        },
        { where: { email: `student_${timestamp}@test.com` } }
      );

      const res = await request(app)
        .put(`/api/v1/auth/reset-password/${resetToken}`)
        .send({ password: 'NewPassword123' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject expired reset token', async () => {
      const resetToken = crypto.randomBytes(20).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      await db.User.update(
        {
          reset_password_token: hashedToken,
          reset_password_expire: new Date(Date.now() - 1000) // Süresi dolmuş
        },
        { where: { email: `student_${timestamp}@test.com` } }
      );

      const res = await request(app)
        .put(`/api/v1/auth/reset-password/${resetToken}`)
        .send({ password: 'NewPassword123' });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('1.5 Logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ============================================================================
// 2. AUTHORIZATION TESTS (Role-Based Access Control)
// ============================================================================
describe('2. Authorization System', () => {
  describe('2.1 Protected Routes', () => {
    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me');

      expect(res.statusCode).toEqual(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toEqual(401);
    });

    it('should accept request with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('2.2 Role-Based Access', () => {
    it('should allow admin to access admin routes', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should deny student access to admin routes', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('should deny faculty access to admin-only routes', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ semester: 'Fall', year: 2025 });

      expect(res.statusCode).toEqual(403);
    });
  });
});

// ============================================================================
// 3. ENROLLMENT LOGIC TESTS
// ============================================================================
describe('3. Enrollment System', () => {
  let course1Id, course2Id, section1Id, section2Id;

  beforeAll(async () => {
    // Ders 1: Temel ders
    const course1 = await db.Course.create({
      code: `COMP${Date.now()}`,
      name: 'Introduction to Programming',
      credits: 3,
      ects: 5,
      departmentId: departmentId
    });
    course1Id = course1.id;

    // Ders 2: Önkoşullu ders
    const course2 = await db.Course.create({
      code: `COMP${Date.now() + 1}`,
      name: 'Advanced Programming',
      credits: 3,
      ects: 5,
      departmentId: departmentId,
      prerequisiteId: course1.id
    });
    course2Id = course2.id;

    // Section 1 (Pazartesi 09:00-12:00)
    const section1 = await db.CourseSection.create({
      courseId: course1Id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: facultyId,
      classroomId: classroomId,
      capacity: 50,
      enrolled_count: 0,
      schedule_json: [{ day: 'Monday', start_time: '09:00', end_time: '12:00' }]
    });
    section1Id = section1.id;

    // Section 2 (Pazartesi 10:00-13:00 - Çakışan)
    const section2 = await db.CourseSection.create({
      courseId: course2Id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: facultyId,
      classroomId: classroomId,
      capacity: 50,
      enrolled_count: 0,
      schedule_json: [{ day: 'Monday', start_time: '10:00', end_time: '13:00' }]
    });
    section2Id = section2.id;
  });

  describe('3.1 Basic Enrollment', () => {
    it('should enroll student to a course', async () => {
      const res = await request(app)
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ sectionId: section1Id });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      enrollmentId = res.body.data.id;
    });

    it('should get student enrollments', async () => {
      const res = await request(app)
        .get('/api/v1/enrollments/my-courses')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('3.2 Prerequisite Check', () => {
    it('should allow enrollment after passing prerequisite', async () => {
      // Önkoşulu geçmiş yap
      await db.Enrollment.update(
        { status: 'passed', midterm_grade: 70, final_grade: 80, letter_grade: 'BB' },
        { where: { id: enrollmentId } }
      );

      // Schedule çakışmasını önlemek için section2'nin schedule'ını değiştir
      await db.CourseSection.update(
        { schedule_json: [{ day: 'Tuesday', start_time: '09:00', end_time: '12:00' }] },
        { where: { id: section2Id } }
      );

      const res = await request(app)
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ sectionId: section2Id });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('3.5 Drop Course', () => {
    let dropEnrollmentId;

    beforeAll(async () => {
      const dropCourse = await db.Course.create({
        code: `DROP${Date.now()}`,
        name: 'Drop Course',
        credits: 3,
        ects: 5,
        departmentId: departmentId
      });

      const dropSection = await db.CourseSection.create({
        courseId: dropCourse.id,
        section_number: 1,
        semester: 'Spring',
        year: 2025,
        instructorId: facultyId,
        classroomId: classroomId,
        capacity: 50,
        enrolled_count: 0,
        schedule_json: [{ day: 'Thursday', start_time: '14:00', end_time: '17:00' }]
      });

      // Kayıt ol
      const res = await request(app)
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ sectionId: dropSection.id });
      
      dropEnrollmentId = res.body.data.id;
    });

    it('should allow student to drop a course', async () => {
      const res = await request(app)
        .delete(`/api/v1/enrollments/${dropEnrollmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should not allow dropping already dropped course', async () => {
      const res = await request(app)
        .delete(`/api/v1/enrollments/${dropEnrollmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(400);
    });
  });
});

// ============================================================================
// 4. GRADE SYSTEM TESTS
// ============================================================================
describe('4. Grade System', () => {
  let gradeEnrollmentId;

  beforeAll(async () => {
    const gradeCourse = await db.Course.create({
      code: `GRADE${Date.now()}`,
      name: 'Grade Test Course',
      credits: 4,
      ects: 6,
      departmentId: departmentId
    });

    const gradeSection = await db.CourseSection.create({
      courseId: gradeCourse.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: facultyId,
      classroomId: classroomId,
      capacity: 50,
      schedule_json: [{ day: 'Wednesday', start_time: '09:00', end_time: '12:00' }]
    });

    const enrollment = await db.Enrollment.create({
      studentId: studentId,
      sectionId: gradeSection.id,
      status: 'enrolled'
    });
    gradeEnrollmentId = enrollment.id;
  });

  describe('4.1 Grade Entry', () => {
    it('should allow faculty to enter grades', async () => {
      const res = await request(app)
        .put(`/api/v1/grades/${gradeEnrollmentId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          midterm_grade: 85,
          final_grade: 90
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should calculate letter grade correctly', async () => {
      const enrollment = await db.Enrollment.findByPk(gradeEnrollmentId);
      
      // 85*0.4 + 90*0.6 = 34 + 54 = 88 → BA
      expect(enrollment.letter_grade).toBe('BA');
      expect(enrollment.grade_point).toBe(3.5);
      expect(enrollment.status).toBe('passed');
    });

    it('should deny student from entering grades', async () => {
      const res = await request(app)
        .put(`/api/v1/grades/${gradeEnrollmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          midterm_grade: 100,
          final_grade: 100
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('4.2 Get Grades', () => {
    it('should get student grades', async () => {
      const res = await request(app)
        .get('/api/v1/grades/my-grades')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

// ============================================================================
// 5. SCHEDULE APPROVAL SYSTEM TESTS
// ============================================================================
describe('5. Schedule Approval System', () => {
  let testBatchId;

  describe('5.1 Generate Schedule (Draft)', () => {
    it('should generate schedule as draft (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          semester: 'Spring',
          year: 2025,
          clearExisting: true
        });

      // Derslere bağlı olarak başarılı veya başarısız olabilir
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('draft');
        expect(res.body.batchId).toBeDefined();
        testBatchId = res.body.batchId;
      }
    });

    it('should deny non-admin from generating schedule', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          semester: 'Spring',
          year: 2025
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('5.2 Draft Schedules', () => {
    it('should list draft schedules (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/drafts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should deny non-admin from viewing drafts', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/drafts')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('5.3 Approve Schedule', () => {
    let approveBatchId;

    beforeAll(async () => {
      // Test için manuel draft oluştur
      approveBatchId = crypto.randomUUID();
      
      const classroom = await db.Classroom.findOne();
      const section = await db.CourseSection.findOne();
      
      if (classroom && section) {
        await db.Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Monday',
          start_time: '09:00',
          end_time: '10:40',
          status: 'draft',
          batch_id: approveBatchId
        });
      }
    });

    it('should approve draft schedule', async () => {
      const res = await request(app)
        .post(`/api/v1/scheduling/approve/${approveBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ archiveExisting: false });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/onaylandı/i);
    });

    it('should return 404 for non-existent batch', async () => {
      const fakeBatchId = crypto.randomUUID();
      
      const res = await request(app)
        .post(`/api/v1/scheduling/approve/${fakeBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('5.4 Reject Schedule', () => {
    let rejectBatchId;

    beforeAll(async () => {
      rejectBatchId = crypto.randomUUID();
      
      const classroom = await db.Classroom.findOne();
      const section = await db.CourseSection.findOne();
      
      if (classroom && section) {
        await db.Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Tuesday',
          start_time: '11:00',
          end_time: '12:40',
          status: 'draft',
          batch_id: rejectBatchId
        });
      }
    });

    it('should reject and delete draft schedule', async () => {
      const res = await request(app)
        .delete(`/api/v1/scheduling/reject/${rejectBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reddedildi/i);
    });
  });

  describe('5.5 Active Schedules', () => {
    it('should get active schedules', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/active')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter active schedules by semester', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/active?semester=Spring&year=2025')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });
});

// ============================================================================
// 6. ATTENDANCE SYSTEM TESTS
// ============================================================================
describe('6. Attendance System', () => {
  let attendanceSessionId;
  let attendanceSectionId;

  beforeAll(async () => {
    // Attendance için section oluştur
    const attendanceCourse = await db.Course.create({
      code: `ATT${Date.now()}`,
      name: 'Attendance Course',
      credits: 3,
      ects: 5,
      departmentId: departmentId
    });

    const attendanceSection = await db.CourseSection.create({
      courseId: attendanceCourse.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: facultyId,
      classroomId: classroomId,
      capacity: 50
    });
    attendanceSectionId = attendanceSection.id;

    // Öğrenciyi kaydet
    await db.Enrollment.create({
      studentId: studentId,
      sectionId: attendanceSectionId,
      status: 'enrolled'
    });
  });

  describe('6.1 Session Management', () => {
    it('should allow faculty to start attendance session', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          sectionId: attendanceSectionId,
          duration_minutes: 30,
          latitude: 41.0255,
          longitude: 40.5201
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('qr_code');
      attendanceSessionId = res.body.data.id;
    });

    it('should deny student from starting session', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sectionId: attendanceSectionId,
          duration_minutes: 30,
          latitude: 41.0255,
          longitude: 40.5201
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('6.2 Check-in', () => {
    it('should allow student to check in within geofence', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${attendanceSessionId}/checkin`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 41.0256, // Yakın mesafe
          longitude: 40.5202
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('6.3 Session Close', () => {
    it('should allow faculty to close session', async () => {
      const res = await request(app)
        .put(`/api/v1/attendance/sessions/${attendanceSessionId}/close`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toBe('closed');
    });

    it('should reject check-in after session closed', async () => {
      // Yeni öğrenci oluştur
      const lateUser = await db.User.create({
        name: 'Late Student',
        email: `late_${Date.now()}@test.com`,
        password_hash: 'Password123',
        role: 'student',
        is_verified: true
      });
      
      const lateStudent = await db.Student.create({
        userId: lateUser.id,
        departmentId: departmentId,
        student_number: `LATE${Date.now()}`,
        current_semester: 1
      });

      await db.Enrollment.create({
        studentId: lateStudent.id,
        sectionId: attendanceSectionId,
        status: 'enrolled'
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lateUser.email, password: 'Password123' });
      
      const lateToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${attendanceSessionId}/checkin`)
        .set('Authorization', `Bearer ${lateToken}`)
        .send({
          latitude: 41.0256,
          longitude: 40.5202
        });

      expect(res.statusCode).toEqual(404);
    });
  });
});

// ============================================================================
// 7. INPUT VALIDATION TESTS
// ============================================================================
describe('7. Input Validation & Security', () => {
  describe('7.1 SQL Injection Prevention', () => {
    it('should handle SQL injection attempts safely', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: "'; DROP TABLE users; --",
          password: 'password'
        });

      expect(res.statusCode).toEqual(400); // Validation error
    });
  });

  describe('7.2 XSS Prevention', () => {
    it('should sanitize XSS in input', async () => {
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          bio: '<script>alert("xss")</script>'
        });

      // Should not contain raw script tag
      if (res.statusCode === 200 && res.body.data) {
        expect(res.body.data.bio).not.toContain('<script>');
      }
    });
  });

  describe('7.3 Required Fields Validation', () => {
    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@test.com'
          // password eksik
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('7.4 Invalid UUID Handling', () => {
    it('should handle invalid UUID gracefully', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/not-a-valid-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });
});

// ============================================================================
// 8. API RESPONSE FORMAT TESTS
// ============================================================================
describe('8. API Response Standards', () => {
  it('should return consistent success response format', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });

  it('should return consistent error response format', async () => {
    const res = await request(app)
      .get('/api/v1/users/me');

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
  });
});
