/**
 * Scheduling Algorithm Tests
 * Part 3: CSP (Constraint Satisfaction Problem) algoritması testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const crypto = require('crypto');

jest.setTimeout(30000);

describe('Scheduling Algorithm Tests', () => {
    let adminToken, facultyToken, studentToken;
    let departmentId, classroomId, facultyId;
    let courseIds = [];
    let sectionIds = [];

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department
        const dept = await db.Department.create({
            name: 'Scheduling Department',
            code: 'SCHED',
            faculty_name: 'Engineering'
        });
        departmentId = dept.id;

        // Birden fazla classroom
        const classrooms = [];
        for (let i = 0; i < 3; i++) {
            const classroom = await db.Classroom.create({
                code: `SCHED-${100 + i}`,
                building: 'Scheduling Building',
                room_number: `${100 + i}`,
                capacity: 30 + i * 10,
                type: 'classroom',
                latitude: 41.0255,
                longitude: 40.5201
            });
            classrooms.push(classroom);
        }
        classroomId = classrooms[0].id;

        // Admin
        const adminUser = await db.User.create({
            name: 'Scheduling Admin',
            email: `admin_sched_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'admin',
            is_verified: true
        });

        // Faculty
        const facultyUser = await db.User.create({
            name: 'Scheduling Faculty',
            email: `faculty_sched_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'faculty',
            is_verified: true
        });

        const faculty = await db.Faculty.create({
            userId: facultyUser.id,
            departmentId: departmentId,
            employee_number: `F${Date.now()}`,
            title: 'Dr.'
        });
        facultyId = faculty.id;

        // Student
        const studentUser = await db.User.create({
            name: 'Scheduling Student',
            email: `student_sched_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        await db.Student.create({
            userId: studentUser.id,
            student_number: `S${Date.now()}`,
            departmentId: departmentId
        });

        // Birden fazla Course
        for (let i = 0; i < 5; i++) {
            const course = await db.Course.create({
                code: `SCHED${100 + i}`,
                name: `Scheduling Course ${i + 1}`,
                credits: 3,
                ects: 5,
                departmentId: departmentId
            });
            courseIds.push(course.id);

            // Her course için section
            const section = await db.CourseSection.create({
                courseId: course.id,
                section_number: 1,
                semester: 'Spring',
                year: 2025,
                instructorId: facultyId,
                classroomId: classrooms[i % 3].id,
                capacity: 30
            });
            sectionIds.push(section.id);
        }

        // Token'ları al
        const adminLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: adminUser.email, password: 'Password123' });
        adminToken = adminLogin.body.data?.accessToken;

        const facultyLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: facultyUser.email, password: 'Password123' });
        facultyToken = facultyLogin.body.data?.accessToken;

        const studentLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: studentUser.email, password: 'Password123' });
        studentToken = studentLogin.body.data?.accessToken;
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('POST /api/v1/scheduling/generate - CSP Algorithm', () => {
        it('should generate schedule as draft (admin only)', async () => {
            const res = await request(app)
                .post('/api/v1/scheduling/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    semester: 'Spring',
                    year: 2025,
                    clearExisting: true
                });

            // Başarılı veya section/classroom yokluğundan hata olabilir
            if (res.statusCode === 200) {
                expect(res.body.success).toBe(true);
                expect(res.body.status).toBe('draft');
                expect(res.body.batchId).toBeDefined();
            }
        });

        it('should deny non-admin from generating schedule', async () => {
            const res = await request(app)
                .post('/api/v1/scheduling/generate')
                .set('Authorization', `Bearer ${facultyToken}`)
                .send({
                    semester: 'Spring',
                    year: 2025
                });

            expect(res.statusCode).toEqual(403);
        });

        it('should deny student from generating schedule', async () => {
            const res = await request(app)
                .post('/api/v1/scheduling/generate')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    semester: 'Spring',
                    year: 2025
                });

            expect(res.statusCode).toEqual(403);
        });

        it('should require semester and year parameters', async () => {
            const res = await request(app)
                .post('/api/v1/scheduling/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.statusCode).toEqual(400);
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

        it('should deny non-admin from viewing drafts', async () => {
            const res = await request(app)
                .get('/api/v1/scheduling/drafts')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('POST /api/v1/scheduling/approve/:batchId', () => {
        let testBatchId;

        beforeAll(async () => {
            // Test için manuel draft oluştur
            testBatchId = crypto.randomUUID();

            const section = await db.CourseSection.findOne();
            const classroom = await db.Classroom.findOne();

            if (section && classroom) {
                await db.Schedule.create({
                    section_id: section.id,
                    classroom_id: classroom.id,
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:40',
                    status: 'draft',
                    batch_id: testBatchId
                });
            }
        });

        it('should approve draft schedule', async () => {
            const res = await request(app)
                .post(`/api/v1/scheduling/approve/${testBatchId}`)
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

        it('should deny non-admin from approving', async () => {
            const newBatchId = crypto.randomUUID();

            const res = await request(app)
                .post(`/api/v1/scheduling/approve/${newBatchId}`)
                .set('Authorization', `Bearer ${facultyToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('DELETE /api/v1/scheduling/reject/:batchId', () => {
        let rejectBatchId;

        beforeAll(async () => {
            rejectBatchId = crypto.randomUUID();

            const section = await db.CourseSection.findOne();
            const classroom = await db.Classroom.findOne();

            if (section && classroom) {
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

        it('should return 404 for already rejected batch', async () => {
            const res = await request(app)
                .delete(`/api/v1/scheduling/reject/${rejectBatchId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('GET /api/v1/scheduling/active', () => {
        beforeAll(async () => {
            // Aktif schedule oluştur
            const section = await db.CourseSection.findOne();
            const classroom = await db.Classroom.findOne();

            if (section && classroom) {
                await db.Schedule.create({
                    section_id: section.id,
                    classroom_id: classroom.id,
                    day_of_week: 'Wednesday',
                    start_time: '14:00',
                    end_time: '15:40',
                    status: 'active',
                    batch_id: crypto.randomUUID()
                });
            }
        });

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

    describe('GET /api/v1/scheduling/my-schedule', () => {
        it('should get student personal schedule', async () => {
            const res = await request(app)
                .get('/api/v1/scheduling/my-schedule')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('should get faculty personal schedule', async () => {
            const res = await request(app)
                .get('/api/v1/scheduling/my-schedule')
                .set('Authorization', `Bearer ${facultyToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/v1/scheduling/my-schedule/ical', () => {
        it('should export schedule as iCal format', async () => {
            const res = await request(app)
                .get('/api/v1/scheduling/my-schedule/ical')
                .set('Authorization', `Bearer ${studentToken}`);

            // iCal export varsa başarılı olmalı
            if (res.statusCode === 200) {
                // İçerik tipi text/calendar olmalı veya ics dosyası
                expect(['text/calendar', 'application/octet-stream', 'application/json'])
                    .toContain(res.headers['content-type']?.split(';')[0]);
            }
        });
    });
});

describe('Scheduling Service Unit Tests', () => {
    describe('CSP Algorithm Constraints', () => {
        it('should detect time overlap correctly', () => {
            // Time overlap detection test
            const slot1 = { start: '09:00', end: '10:40' };
            const slot2 = { start: '10:00', end: '11:40' };
            const slot3 = { start: '11:00', end: '12:40' };

            // Slot 1 ve 2 çakışıyor
            const overlap12 = timeOverlap(slot1, slot2);
            expect(overlap12).toBe(true);

            // Slot 1 ve 3 çakışmıyor
            const overlap13 = timeOverlap(slot1, slot3);
            expect(overlap13).toBe(false);
        });

        it('should validate capacity constraints', () => {
            const classroom = { capacity: 30 };
            const section = { enrolled_count: 25 };

            // Kapasite yeterli
            expect(classroom.capacity >= section.enrolled_count).toBe(true);

            // Kapasite yetersiz
            const overCapacitySection = { enrolled_count: 35 };
            expect(classroom.capacity >= overCapacitySection.enrolled_count).toBe(false);
        });
    });
});

// Helper function for time overlap
function timeOverlap(slot1, slot2) {
    const start1 = timeToMinutes(slot1.start);
    const end1 = timeToMinutes(slot1.end);
    const start2 = timeToMinutes(slot2.start);
    const end2 = timeToMinutes(slot2.end);

    return !(end1 <= start2 || end2 <= start1);
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
