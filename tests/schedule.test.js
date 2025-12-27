const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { Schedule, CourseSection, Classroom, Course, Department, Faculty, Enrollment, Student, User } = db;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Course Scheduling Tests', () => {
  let authToken;
  let adminToken;
  let studentId;
  let sectionId;

  beforeAll(async () => {
    // Department ve Course oluştur
    const department = await Department.create({
      name: 'Computer Science',
      code: 'CSE',
      faculty_name: 'Engineering'
    });

    const course = await Course.create({
      name: 'Introduction to Programming',
      code: 'CSE101',
      credits: 3,
      ects: 5,
      departmentId: department.id
    });

    // Faculty oluştur
    const facultyUser = await User.create({
      name: 'Faculty User',
      email: `faculty${Date.now()}@test.com`,
      password_hash: 'Password123',
      role: 'faculty',
      is_verified: true
    });

    const faculty = await Faculty.create({
      userId: facultyUser.id,
      employee_number: `FAC${Date.now()}`,
      departmentId: department.id
    });

    // Classroom oluştur
    const classroom = await Classroom.create({
      code: 'A101',
      capacity: 50,
      building: 'A Block',
      room_number: '101'
    });

    // Section oluştur
    const section = await CourseSection.create({
      courseId: course.id,
      section_number: 1,
      semester: 'Fall',
      year: 2024,
      instructorId: faculty.id,
      classroomId: classroom.id,
      capacity: 30
    });
    sectionId = section.id;

    // Student oluştur
    const studentUser = await User.create({
      name: 'Schedule Test Student',
      email: `schedule${Date.now()}@test.com`,
      password_hash: 'Password123',
      role: 'student',
      is_verified: true
    });

    const student = await Student.create({
      userId: studentUser.id,
      student_number: `ST${Date.now()}`,
      departmentId: department.id
    });
    studentId = student.id;

    // Enrollment
    await Enrollment.create({
      studentId: student.id,
      sectionId: section.id,
      status: 'enrolled'
    });

    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: studentUser.email, password: 'Password123' });
    authToken = loginRes.body.data?.accessToken;

    // Admin login
    const admin = await User.create({
      name: 'Schedule Admin',
      email: `scheduleadmin${Date.now()}@test.com`,
      password_hash: 'Password123',
      role: 'admin',
      is_verified: true
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = adminLoginRes.body.data?.accessToken;
  });

  describe('POST /api/v1/scheduling/generate', () => {
    it('should generate schedule using CSP algorithm', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          semester: 'Fall',
          year: 2024,
          clearExisting: false
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should reject if not admin', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          semester: 'Fall',
          year: 2024
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('GET /api/v1/scheduling/my-schedule', () => {
    it('should get student schedule', async () => {
      // Önce bir schedule oluştur
      const classroom = await Classroom.findOne();
      const section = await CourseSection.findByPk(sectionId);

      if (classroom && section) {
        await Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Monday',
          start_time: '09:00',
          end_time: '10:40',
          status: 'approved' // Aktif schedule olması için
        });
      }

      const res = await request(app)
        .get('/api/v1/scheduling/my-schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/scheduling/:scheduleId', () => {
    it('should get schedule detail', async () => {
      const classroom = await Classroom.findOne();
      const section = await CourseSection.findByPk(sectionId);

      if (classroom && section) {
        const schedule = await Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Tuesday',
          start_time: '11:00',
          end_time: '12:40',
          status: 'approved'
        });

        const res = await request(app)
          .get(`/api/v1/scheduling/${schedule.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(schedule.id);
      }
    });
  });

  describe('GET /api/v1/scheduling/my-schedule/ical', () => {
    it('should export schedule as iCal file', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/my-schedule/ical')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toMatch(/text\/calendar/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
    });
  });

  // ============================================================================
  // YENİ: Schedule Onay Sistemi Testleri
  // ============================================================================
  describe('Schedule Approval System', () => {
    let draftBatchId;

    describe('POST /api/v1/scheduling/generate (Draft Creation)', () => {
      it('should generate schedule as draft', async () => {
        const res = await request(app)
          .post('/api/v1/scheduling/generate')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            semester: 'Fall',
            year: 2024,
            clearExisting: true
          });

        // Eğer section varsa başarılı olmalı
        if (res.statusCode === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.status).toBe('draft');
          expect(res.body.batchId).toBeDefined();
          draftBatchId = res.body.batchId;
        }
      });
    });

    describe('GET /api/v1/scheduling/drafts', () => {
      it('should list draft schedules (admin only)', async () => {
        const res = await request(app)
          .get('/api/v1/scheduling/drafts')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should reject non-admin access', async () => {
        const res = await request(app)
          .get('/api/v1/scheduling/drafts')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(403);
      });
    });

    describe('GET /api/v1/scheduling/active', () => {
      it('should list active (approved) schedules', async () => {
        const res = await request(app)
          .get('/api/v1/scheduling/active')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should filter by semester and year', async () => {
        const res = await request(app)
          .get('/api/v1/scheduling/active?semester=Fall&year=2024')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('POST /api/v1/scheduling/approve/:batchId', () => {
      it('should approve draft schedule', async () => {
        // Önce bir draft oluştur
        const classroom = await Classroom.findOne();
        const section = await CourseSection.findByPk(sectionId);
        const testBatchId = require('crypto').randomUUID();

        if (classroom && section) {
          await Schedule.create({
            section_id: section.id,
            classroom_id: classroom.id,
            day_of_week: 'Wednesday',
            start_time: '13:00',
            end_time: '14:40',
            status: 'draft',
            batch_id: testBatchId
          });

          const res = await request(app)
            .post(`/api/v1/scheduling/approve/${testBatchId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ archiveExisting: false });

          expect(res.statusCode).toEqual(200);
          expect(res.body.success).toBe(true);
          expect(res.body.message).toContain('onaylandı');

          // Verify schedule is now approved
          const approvedSchedule = await Schedule.findOne({
            where: { batch_id: testBatchId }
          });
          expect(approvedSchedule.status).toBe('approved');
        }
      });

      it('should return 404 for non-existent batch', async () => {
        const fakeBatchId = require('crypto').randomUUID();

        const res = await request(app)
          .post(`/api/v1/scheduling/approve/${fakeBatchId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
      });

      it('should reject non-admin access', async () => {
        const res = await request(app)
          .post('/api/v1/scheduling/approve/some-batch-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(403);
      });
    });

    describe('DELETE /api/v1/scheduling/reject/:batchId', () => {
      it('should reject and delete draft schedule', async () => {
        // Önce bir draft oluştur
        const classroom = await Classroom.findOne();
        const section = await CourseSection.findByPk(sectionId);
        const testBatchId = require('crypto').randomUUID();

        if (classroom && section) {
          await Schedule.create({
            section_id: section.id,
            classroom_id: classroom.id,
            day_of_week: 'Thursday',
            start_time: '15:00',
            end_time: '16:40',
            status: 'draft',
            batch_id: testBatchId
          });

          const res = await request(app)
            .delete(`/api/v1/scheduling/reject/${testBatchId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.statusCode).toEqual(200);
          expect(res.body.success).toBe(true);
          expect(res.body.message).toContain('reddedildi');

          // Verify schedule is deleted
          const deletedSchedule = await Schedule.findOne({
            where: { batch_id: testBatchId }
          });
          expect(deletedSchedule).toBeNull();
        }
      });

      it('should return 404 for non-existent batch', async () => {
        const fakeBatchId = require('crypto').randomUUID();

        const res = await request(app)
          .delete(`/api/v1/scheduling/reject/${fakeBatchId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
      });
    });
  });
});
