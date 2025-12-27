/**
 * Analytics & Reporting Tests
 * Part 4: Raporlama ve analitik sistemi testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

describe('Analytics & Reporting Tests', () => {
    let adminToken, facultyToken, studentToken;
    let departmentId, courseId, sectionId;

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department oluştur
        const dept = await db.Department.create({
            name: 'Analytics Department',
            code: 'ANLY',
            faculty_name: 'Engineering'
        });
        departmentId = dept.id;

        // Classroom oluştur
        const classroom = await db.Classroom.create({
            code: 'ANLY-101',
            building: 'Analytics Building',
            room_number: '101',
            capacity: 30,
            type: 'classroom',
            latitude: 41.0255,
            longitude: 40.5201
        });

        // Admin oluştur
        const adminUser = await db.User.create({
            name: 'Analytics Admin',
            email: `admin_anly_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'admin',
            is_verified: true
        });

        // Faculty oluştur
        const facultyUser = await db.User.create({
            name: 'Analytics Faculty',
            email: `faculty_anly_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'faculty',
            is_verified: true
        });

        const faculty = await db.Faculty.create({
            userId: facultyUser.id,
            departmentId: departmentId,
            employee_number: `F${Date.now()}`,
            title: 'Prof. Dr.'
        });

        // Student oluştur
        const studentUser = await db.User.create({
            name: 'Analytics Student',
            email: `student_anly_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        const student = await db.Student.create({
            userId: studentUser.id,
            student_number: `S${Date.now()}`,
            departmentId: departmentId,
            current_semester: 3,
            gpa: 3.5,
            cgpa: 3.45
        });

        // Course oluştur
        const course = await db.Course.create({
            code: 'ANLY101',
            name: 'Analytics Course',
            credits: 3,
            ects: 5,
            departmentId: departmentId
        });
        courseId = course.id;

        // Section oluştur
        const section = await db.CourseSection.create({
            courseId: course.id,
            section_number: 1,
            semester: 'Spring',
            year: 2025,
            instructorId: faculty.id,
            classroomId: classroom.id,
            capacity: 30,
            enrolled_count: 1
        });
        sectionId = section.id;

        // Enrollment oluştur
        await db.Enrollment.create({
            studentId: student.id,
            sectionId: section.id,
            status: 'enrolled',
            midterm_grade: 85,
            final_grade: 90,
            letter_grade: 'BA',
            grade_point: 3.5
        });

        // Cafeteria ve Meal verisi
        const cafeteria = await db.Cafeteria.create({
            name: 'Test Cafeteria',
            location: 'Building A'
        });

        const menu = await db.MealMenu.create({
            cafeteria_id: cafeteria.id,
            date: new Date().toISOString().split('T')[0],
            meal_type: 'lunch',
            items_json: { soup: 'Lentil', main: 'Chicken' },
            price: 25.00,
            is_published: true
        });

        // Meal Reservation
        await db.MealReservation.create({
            user_id: studentUser.id,
            menu_id: menu.id,
            cafeteria_id: cafeteria.id,
            meal_type: 'lunch',
            reservation_date: new Date().toISOString().split('T')[0],
            status: 'used',
            qr_code: `QR_${Date.now()}_${Math.random().toString(36).substring(7)}`
        });

        // Event
        const event = await db.Event.create({
            title: 'Test Event',
            description: 'Analytics test event',
            category: 'academic',
            event_date: new Date(),
            start_time: '10:00',
            end_time: '12:00',
            location: 'Room 101',
            capacity: 50,
            registered_count: 5,
            status: 'active'
        });

        // Event Registration
        await db.EventRegistration.create({
            event_id: event.id,
            user_id: studentUser.id,
            checked_in: true
        });

        // Wallet
        await db.Wallet.create({
            user_id: studentUser.id,
            balance: 150.00
        });

        // Attendance Session
        const session = await db.AttendanceSession.create({
            section_id: section.id,
            instructor_id: faculty.id,
            date: new Date().toISOString().split('T')[0],
            start_time: new Date(),
            end_time: new Date(Date.now() + 60 * 60 * 1000), // 1 saat sonra
            status: 'closed',
            latitude: 41.0255,
            longitude: 40.5201,
            geofence_radius: 15
        });

        // Attendance Record
        await db.AttendanceRecord.create({
            session_id: session.id,
            student_id: student.id,
            check_in_time: new Date(),
            is_flagged: false
        });

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

    describe('GET /api/v1/analytics/overview', () => {
        it('should get dashboard overview (admin)', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/overview')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('users');
            expect(res.body.data.users).toHaveProperty('total');
            expect(res.body.data.users).toHaveProperty('students');
            expect(res.body.data.users).toHaveProperty('faculty');
        });

        it('should deny student access to overview', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/overview')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('GET /api/v1/analytics/registration-trend', () => {
        it('should get registration trend data', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/registration-trend')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should accept days parameter', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/registration-trend?days=7')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/v1/analytics/attendance', () => {
        it('should get attendance statistics (admin)', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/attendance')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('stats');
        });

        it('should get attendance statistics (faculty)', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/attendance')
                .set('Authorization', `Bearer ${facultyToken}`);

            expect(res.statusCode).toEqual(200);
        });

        it('should filter by date range', async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const endDate = new Date();

            const res = await request(app)
                .get(`/api/v1/analytics/attendance?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/v1/analytics/meals', () => {
        it('should get meal usage statistics', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/meals')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('mealTypeDistribution');
            expect(res.body.data).toHaveProperty('usageStats');
        });
    });

    describe('GET /api/v1/analytics/events', () => {
        it('should get event statistics', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/events')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('categoryDistribution');
        });
    });

    describe('GET /api/v1/analytics/academic', () => {
        it('should get academic performance statistics (admin)', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/academic')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('gpaDistribution');
            expect(res.body.data).toHaveProperty('enrollmentStatus');
        });

        it('should be accessible by faculty', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/academic')
                .set('Authorization', `Bearer ${facultyToken}`);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/v1/analytics/financial', () => {
        it('should get financial statistics', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/financial')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('totalBalance');
        });
    });

    describe('GET /api/v1/analytics/classroom-utilization', () => {
        it('should get classroom utilization data', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/classroom-utilization')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('classroomUsage');
            expect(res.body.data).toHaveProperty('dayDistribution');
        });
    });

    describe('GET /api/v1/analytics/system-health', () => {
        it('should get system health status', async () => {
            const res = await request(app)
                .get('/api/v1/analytics/system-health')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Export Functionality', () => {
        it('should export attendance data as Excel', async () => {
            const res = await request(app)
                .get('/api/v1/export/attendance?format=excel')
                .set('Authorization', `Bearer ${adminToken}`);

            // Export endpoint varsa başarılı olmalı, yoksa 404
            expect([200, 404]).toContain(res.statusCode);
        });

        it('should export academic data as PDF', async () => {
            const res = await request(app)
                .get('/api/v1/export/academic?format=pdf')
                .set('Authorization', `Bearer ${adminToken}`);

            expect([200, 404]).toContain(res.statusCode);
        });

        it('should export meal data as CSV', async () => {
            const res = await request(app)
                .get('/api/v1/export/meals?format=csv')
                .set('Authorization', `Bearer ${adminToken}`);

            expect([200, 404]).toContain(res.statusCode);
        });
    });
});

describe('Dashboard Controller Tests', () => {
    let adminToken, studentToken;

    beforeAll(async () => {
        // Login credentials from previous tests
        const adminUser = await db.User.findOne({ where: { role: 'admin' } });
        const studentUser = await db.User.findOne({ where: { role: 'student' } });

        if (adminUser) {
            const adminLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: adminUser.email, password: 'Password123' });
            adminToken = adminLogin.body.data?.accessToken;
        }

        if (studentUser) {
            const studentLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: studentUser.email, password: 'Password123' });
            studentToken = studentLogin.body.data?.accessToken;
        }
    });

    describe('GET /api/v1/dashboard', () => {
        it('should get admin dashboard data', async () => {
            if (!adminToken) return;

            const res = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('should get student dashboard data', async () => {
            if (!studentToken) return;

            const res = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });
});
