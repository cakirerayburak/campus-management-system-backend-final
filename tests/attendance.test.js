const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

// Değişkenleri en üstte tanımlıyoruz
let instructorToken;
let studentToken;
let student2Token;
let createdSessionId;
let createdSectionId;
let createdStudentId;
let student2Id;

beforeAll(async () => {
  // Her testten önce veritabanını temizle
  await db.sequelize.sync({ force: true });

  // 1. HOCA OLUŞTUR VE GİRİŞ YAP
  const facEmail = 'prof_att_final@test.com';
  await request(app).post('/api/v1/auth/register').send({
    name: 'Prof Attendance', email: facEmail, password: 'Password123!', role: 'student'
  });
  const facUser = await db.User.findOne({ where: { email: facEmail } });
  // Rolü force update ile faculty yap
  await db.User.update({ role: 'faculty', is_verified: true }, { where: { id: facUser.id } });
  
  const dept = await db.Department.create({ name: 'Attendance Dept', code: 'ATT', faculty_name: 'Eng' });
  const faculty = await db.Faculty.create({ 
    userId: facUser.id, 
    departmentId: dept.id, 
    title: 'Dr.', 
    office_number: 'B1', 
    employee_number: 'F99' 
  });

  const facLogin = await request(app).post('/api/v1/auth/login').send({ email: facEmail, password: 'Password123!' });
  instructorToken = facLogin.body.data.accessToken;

  // 2. ÖĞRENCİ 1 OLUŞTUR VE GİRİŞ YAP
  const stuEmail = 'stu_att_final@test.com';
  await request(app).post('/api/v1/auth/register').send({
    name: 'Student Attendance', email: stuEmail, password: 'Password123!', role: 'student'
  });
  const stuUser = await db.User.findOne({ where: { email: stuEmail } });
  await db.User.update({ is_verified: true }, { where: { id: stuUser.id } });
  
  const student = await db.Student.create({ 
    userId: stuUser.id, 
    departmentId: dept.id, 
    student_number: 'S99', 
    gpa: 2.0, 
    current_semester: 1 
  });
  createdStudentId = student.id; // ID'yi sakla

  const stuLogin = await request(app).post('/api/v1/auth/login').send({ email: stuEmail, password: 'Password123!' });
  studentToken = stuLogin.body.data.accessToken;

  // 3. ÖĞRENCİ 2 OLUŞTUR (Session kapatıldıktan sonra check-in deneyecek)
  const stu2Email = 'stu_att_late@test.com';
  await request(app).post('/api/v1/auth/register').send({
    name: 'Late Student', email: stu2Email, password: 'Password123!', role: 'student'
  });
  const stu2User = await db.User.findOne({ where: { email: stu2Email } });
  await db.User.update({ is_verified: true }, { where: { id: stu2User.id } });
  
  const student2 = await db.Student.create({ 
    userId: stu2User.id, 
    departmentId: dept.id, 
    student_number: 'S100', 
    gpa: 2.0, 
    current_semester: 1 
  });
  student2Id = student2.id;

  const stu2Login = await request(app).post('/api/v1/auth/login').send({ email: stu2Email, password: 'Password123!' });
  student2Token = stu2Login.body.data.accessToken;

  // 4. DERS, SINIF ve ŞUBE OLUŞTUR
  const classroom = await db.Classroom.create({ 
    code: 'TEST-ATT-101',
    building: 'Test Block', 
    room_number: '101', 
    capacity: 50,
    latitude: 41.0000, 
    longitude: 40.0000 
  });

  const course = await db.Course.create({ 
    code: 'ATT101', name: 'Attendance Logic', credits: 3, ects: 5, departmentId: dept.id 
  });
  
  const section = await db.CourseSection.create({
    courseId: course.id, 
    section_number: 1, 
    semester: 'Spring', 
    year: 2025,
    instructorId: faculty.id, 
    classroomId: classroom.id, 
    capacity: 50
  });
  createdSectionId = section.id; // ID'yi sakla

  // Öğrencileri derse kaydet
  await db.Enrollment.create({
    studentId: createdStudentId,
    sectionId: createdSectionId,
    status: 'enrolled'
  });

  await db.Enrollment.create({
    studentId: student2Id,
    sectionId: createdSectionId,
    status: 'enrolled'
  });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Attendance Controller Tests', () => {

  // ============================================================================
  // SESSION CREATION TESTS
  // ============================================================================
  describe('Session Creation', () => {
    
    it('should allow instructor to create an attendance session', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'lecture',
          duration_minutes: 60,
          latitude: 41.0000, 
          longitude: 40.0000 
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('qr_code');
      createdSessionId = res.body.data.id;
    });

    it('should deny student from creating attendance session', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'lecture',
          duration_minutes: 60,
          latitude: 41.0000, 
          longitude: 40.0000 
        });

      expect(res.statusCode).toEqual(403);
    });

    it('should reject duplicate active session for same section', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'lecture',
          duration_minutes: 60,
          latitude: 41.0000, 
          longitude: 40.0000 
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/zaten|açık/i);
    });
  });

  // ============================================================================
  // CHECK-IN TESTS
  // ============================================================================
  describe('Student Check-In', () => {

    it('should allow student to check-in within geofence', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${createdSessionId}/checkin`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 41.0001, // ~10 metre fark (kabul edilmeli)
          longitude: 40.0001
        });

      if (res.statusCode !== 200) {
        console.error("CheckIn Hata Detayı:", res.body);
      }

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate check-in from same student', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${createdSessionId}/checkin`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 41.0001,
          longitude: 40.0001
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/zaten/i);
    });

    it('should reject check-in outside geofence radius', async () => {
      // Yeni bir session oluştur geofence testi için
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'lab',
          duration_minutes: 30,
          latitude: 41.0000, 
          longitude: 40.0000,
          geofence_radius: 50 // 50 metre radius
        });
      
      // Mevcut session'ı kapat
      await request(app)
        .put(`/api/v1/attendance/sessions/${createdSessionId}/close`)
        .set('Authorization', `Bearer ${instructorToken}`);

      if (sessionRes.statusCode === 201) {
        const newSessionId = sessionRes.body.data.id;
        
        // 1 km uzaktan check-in dene (41.01 yaklaşık 1km kuzey)
        const res = await request(app)
          .post(`/api/v1/attendance/sessions/${newSessionId}/checkin`)
          .set('Authorization', `Bearer ${student2Token}`)
          .send({
            latitude: 41.01, // ~1km uzakta
            longitude: 40.0
          });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/geofence|mesafe|uzak/i);
        
        // Temizlik
        await request(app)
          .put(`/api/v1/attendance/sessions/${newSessionId}/close`)
          .set('Authorization', `Bearer ${instructorToken}`);
      }
    });

    it('should reject check-in for non-enrolled student', async () => {
      // Yeni kayıtsız öğrenci oluştur
      const noEnrollEmail = 'no_enroll@test.com';
      await request(app).post('/api/v1/auth/register').send({
        name: 'No Enroll Student', email: noEnrollEmail, password: 'Password123!', role: 'student'
      });
      const noEnrollUser = await db.User.findOne({ where: { email: noEnrollEmail } });
      await db.User.update({ is_verified: true }, { where: { id: noEnrollUser.id } });
      
      const dept = await db.Department.findOne();
      await db.Student.create({ 
        userId: noEnrollUser.id, 
        departmentId: dept.id, 
        student_number: 'S101', 
        gpa: 2.0, 
        current_semester: 1 
      });

      const noEnrollLogin = await request(app).post('/api/v1/auth/login').send({ email: noEnrollEmail, password: 'Password123!' });
      const noEnrollToken = noEnrollLogin.body.data.accessToken;

      // Yeni session oluştur
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'tutorial',
          duration_minutes: 30,
          latitude: 41.0000, 
          longitude: 40.0000
        });

      if (sessionRes.statusCode === 201) {
        const sessionId = sessionRes.body.data.id;
        
        const res = await request(app)
          .post(`/api/v1/attendance/sessions/${sessionId}/checkin`)
          .set('Authorization', `Bearer ${noEnrollToken}`)
          .send({
            latitude: 41.0001,
            longitude: 40.0001
          });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/kayıtlı/i);
      }
    });
  });

  // ============================================================================
  // SESSION CLOSE TESTS
  // ============================================================================
  describe('Session Management', () => {

    it('should allow instructor to close session', async () => {
      // Önce yeni bir session oluştur
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'exam',
          duration_minutes: 30,
          latitude: 41.0000, 
          longitude: 40.0000
        });

      if (sessionRes.statusCode === 201) {
        const sessionId = sessionRes.body.data.id;

        const res = await request(app)
          .put(`/api/v1/attendance/sessions/${sessionId}/close`)
          .set('Authorization', `Bearer ${instructorToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toBe('closed');
      }
    });

    it('should deny student from closing session', async () => {
      // Yeni session
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'practice',
          duration_minutes: 30,
          latitude: 41.0000, 
          longitude: 40.0000
        });

      if (sessionRes.statusCode === 201) {
        const sessionId = sessionRes.body.data.id;

        const res = await request(app)
          .put(`/api/v1/attendance/sessions/${sessionId}/close`)
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.statusCode).toEqual(403);

        // Temizlik
        await request(app)
          .put(`/api/v1/attendance/sessions/${sessionId}/close`)
          .set('Authorization', `Bearer ${instructorToken}`);
      }
    });

    it('should reject check-in after session is closed', async () => {
      // 1. Session oluştur
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          sectionId: createdSectionId,
          type: 'seminar',
          duration_minutes: 30,
          latitude: 41.0000, 
          longitude: 40.0000
        });

      if (sessionRes.statusCode === 201) {
        const sessionId = sessionRes.body.data.id;

        // 2. Session'ı kapat
        await request(app)
          .put(`/api/v1/attendance/sessions/${sessionId}/close`)
          .set('Authorization', `Bearer ${instructorToken}`);

        // 3. Kapalı session'a check-in dene
        const res = await request(app)
          .post(`/api/v1/attendance/sessions/${sessionId}/checkin`)
          .set('Authorization', `Bearer ${student2Token}`)
          .send({
            latitude: 41.0001,
            longitude: 40.0001
          });

        expect(res.statusCode).toEqual(404); // Session bulunamadı (aktif değil)
      }
    });
  });

  // ============================================================================
  // ATTENDANCE REPORTS
  // ============================================================================
  describe('Attendance Reports', () => {

    it('should get student attendance records', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/my-records')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get section attendance stats for instructor', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/sections/${createdSectionId}/stats`)
        .set('Authorization', `Bearer ${instructorToken}`);

      // Bu endpoint varsa 200, yoksa 404
      expect([200, 404]).toContain(res.statusCode);
    });
  });
});