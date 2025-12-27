/**
 * Test Yardımcı Fonksiyonları
 * API üzerinden kullanıcı oluşturma ve giriş yapma
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const db = require('../../src/models');

/**
 * Test kullanıcısı oluştur ve giriş yap
 * @param {Object} options - Kullanıcı seçenekleri
 * @returns {Object} { user, token, refreshToken }
 */
async function createTestUser(options = {}) {
  const timestamp = Date.now();
  
  // Önce bir department oluştur (student/faculty için gerekli)
  let department = await db.Department.findOne();
  if (!department) {
    department = await db.Department.create({
      name: 'Test Department',
      code: `DEP${timestamp}`,
      faculty_name: 'Test Faculty'
    });
  }
  
  const defaults = {
    name: `Test User ${timestamp}`,
    email: `test_${timestamp}@test.com`,
    password: 'Password123',
    role: 'student',
    department_id: department.id
  };

  const userData = { ...defaults, ...options };

  // API üzerinden kayıt ol
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send(userData);
  
  // Debug: Kayıt başarısız olduysa log bas
  if (registerRes.statusCode !== 201) {
    console.log('Register Error:', registerRes.body);
  }

  // Kullanıcıyı doğrula
  let user = await db.User.findOne({ where: { email: userData.email } });
  
  // User oluşturulmadıysa, doğrudan veritabanına ekle (fallback)
  if (!user) {
    // Password'u hashle (model'in hook'u zaten hashliyor, biz raw ekliyoruz)
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    user = await db.User.create({
      name: userData.name,
      email: userData.email,
      password_hash: hashedPassword,
      role: userData.role,
      is_verified: true
    }, { hooks: false }); // Hook'ları devre dışı bırak (çift hash önleme)
  } else {
    await db.User.update(
      { is_verified: true, role: userData.role },
      { where: { id: user.id } }
    );
    user = await db.User.findByPk(user.id);
  }

  // Giriş yap
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: userData.email,
      password: userData.password
    });

  return {
    user: user,
    token: loginRes.body.data?.accessToken,
    refreshToken: loginRes.body.data?.refreshToken,
    email: userData.email,
    password: userData.password,
    departmentId: department.id
  };
}

/**
 * Admin kullanıcısı oluştur ve giriş yap
 */
async function createAdminUser() {
  return createTestUser({ role: 'admin', name: 'Admin User' });
}

/**
 * Faculty kullanıcısı oluştur ve giriş yap
 */
async function createFacultyUser(departmentId) {
  const result = await createTestUser({ role: 'faculty', name: 'Faculty User' });
  
  if (result.user && departmentId) {
    // Faculty profili oluştur
    await db.Faculty.create({
      userId: result.user.id,
      departmentId: departmentId,
      employee_number: `FAC${Date.now()}`,
      title: 'Dr.',
      office_location: 'A-101'
    });
  }

  return result;
}

/**
 * Student kullanıcısı oluştur ve giriş yap
 */
async function createStudentUser(departmentId) {
  const result = await createTestUser({ role: 'student', name: 'Student User' });
  
  if (result.user && departmentId) {
    // Student profili oluştur
    await db.Student.create({
      userId: result.user.id,
      departmentId: departmentId,
      student_number: `STU${Date.now()}`,
      gpa: 0,
      cgpa: 0,
      current_semester: 1
    });
  }

  return result;
}

/**
 * Test için departman oluştur
 */
async function createTestDepartment(name = 'Test Department') {
  return db.Department.create({
    name: name,
    code: `DEP${Date.now()}`,
    faculty_name: 'Test Faculty'
  });
}

/**
 * Test için sınıf oluştur
 */
async function createTestClassroom() {
  return db.Classroom.create({
    code: `CLS${Date.now()}`,
    building: 'Test Building',
    room_number: `${Math.floor(Math.random() * 999)}`,
    capacity: 50,
    type: 'classroom',
    latitude: 41.0255,
    longitude: 40.5201
  });
}

/**
 * Test için ders oluştur
 */
async function createTestCourse(departmentId, options = {}) {
  return db.Course.create({
    code: `CRS${Date.now()}`,
    name: 'Test Course',
    credits: 3,
    ects: 5,
    departmentId: departmentId,
    ...options
  });
}

/**
 * Test için section oluştur
 */
async function createTestSection(courseId, instructorId, classroomId, options = {}) {
  return db.CourseSection.create({
    courseId: courseId,
    section_number: 1,
    semester: 'Spring',
    year: 2025,
    instructorId: instructorId,
    classroomId: classroomId,
    capacity: 50,
    enrolled_count: 0,
    schedule_json: [{ day: 'Monday', start_time: '09:00', end_time: '12:00' }],
    ...options
  });
}

module.exports = {
  createTestUser,
  createAdminUser,
  createFacultyUser,
  createStudentUser,
  createTestDepartment,
  createTestClassroom,
  createTestCourse,
  createTestSection
};
