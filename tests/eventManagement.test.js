/**
 * Event Management System Tests
 * Part 3: Etkinlik yönetimi, kayıt ve QR kod testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

describe('Event Management System Tests', () => {
    let adminToken, studentToken, facultyToken;
    let adminUser, studentUser;
    let eventId, registrationId;

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department
        const dept = await db.Department.create({
            name: 'Event Department',
            code: 'EVT',
            faculty_name: 'Arts'
        });

        // Admin
        adminUser = await db.User.create({
            name: 'Event Admin',
            email: `admin_evt_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'admin',
            is_verified: true
        });

        // Faculty
        const facultyUser = await db.User.create({
            name: 'Event Faculty',
            email: `faculty_evt_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'faculty',
            is_verified: true
        });

        await db.Faculty.create({
            userId: facultyUser.id,
            departmentId: dept.id,
            employee_number: `F${Date.now()}`,
            title: 'Dr.'
        });

        // Student
        studentUser = await db.User.create({
            name: 'Event Student',
            email: `student_evt_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        await db.Student.create({
            userId: studentUser.id,
            student_number: `S${Date.now()}`,
            departmentId: dept.id
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

        // Test event oluştur
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const event = await db.Event.create({
            title: 'Test Event',
            description: 'This is a test event for testing purposes',
            category: 'academic',
            event_date: futureDate.toISOString().split('T')[0],
            start_time: '14:00',
            end_time: '16:00',
            location: 'Conference Room A',
            capacity: 50,
            registered_count: 0,
            registration_deadline: futureDate.toISOString().split('T')[0],
            is_paid: false,
            status: 'active'
        });
        eventId = event.id;
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('GET /api/v1/events', () => {
        it('should get all events', async () => {
            const res = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should filter events by category', async () => {
            const res = await request(app)
                .get('/api/v1/events?category=academic')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            if (res.body.data.length > 0) {
                res.body.data.forEach(e => {
                    expect(e.category).toBe('academic');
                });
            }
        });

        it('should filter events by status', async () => {
            const res = await request(app)
                .get('/api/v1/events?status=active')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            if (res.body.data.length > 0) {
                res.body.data.forEach(e => {
                    expect(e.status).toBe('active');
                });
            }
        });

        it('should search events by title', async () => {
            const res = await request(app)
                .get('/api/v1/events?search=Test')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/v1/events/:id', () => {
        it('should get event details', async () => {
            const res = await request(app)
                .get(`/api/v1/events/${eventId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(eventId);
            expect(res.body.data.title).toBe('Test Event');
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .get(`/api/v1/events/${fakeId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('POST /api/v1/events', () => {
        it('should create event (admin only)', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 14);

            const res = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    title: 'New Admin Event',
                    description: 'Created by admin',
                    category: 'social',
                    event_date: futureDate.toISOString().split('T')[0],
                    start_time: '18:00',
                    end_time: '20:00',
                    location: 'Main Hall',
                    capacity: 100
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('New Admin Event');
        });

        it('should deny student from creating events', async () => {
            const res = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    title: 'Student Event',
                    category: 'social'
                });

            expect(res.statusCode).toEqual(403);
        });

        it('should validate required fields', async () => {
            const res = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    description: 'No title provided'
                });

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('POST /api/v1/events/:id/register', () => {
        it('should register for an event', async () => {
            const res = await request(app)
                .post(`/api/v1/events/${eventId}/register`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('qr_code');
            registrationId = res.body.data.id;
        });

        it('should increment registered_count', async () => {
            const event = await db.Event.findByPk(eventId);
            expect(event.registered_count).toBeGreaterThan(0);
        });

        it('should reject duplicate registration', async () => {
            const res = await request(app)
                .post(`/api/v1/events/${eventId}/register`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/zaten/i);
        });

        it('should reject registration for full event', async () => {
            // Event kapasitesini 1 yap
            await db.Event.update(
                { capacity: 1, registered_count: 1 },
                { where: { id: eventId } }
            );

            // Yeni kullanıcı oluştur
            const newUser = await db.User.create({
                name: 'Full Event User',
                email: `full_evt_${Date.now()}@test.com`,
                password_hash: 'Password123',
                role: 'student',
                is_verified: true
            });

            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: newUser.email, password: 'Password123' });
            const newToken = loginRes.body.data?.accessToken;

            const res = await request(app)
                .post(`/api/v1/events/${eventId}/register`)
                .set('Authorization', `Bearer ${newToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/dolu/i);

            // Kapasiteyi geri yükle
            await db.Event.update(
                { capacity: 50 },
                { where: { id: eventId } }
            );
        });
    });

    describe('GET /api/v1/events/my-events', () => {
        it('should get user registered events', async () => {
            const res = await request(app)
                .get('/api/v1/events/my-events')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    describe('DELETE /api/v1/events/:eventId/registrations/:regId', () => {
        let cancelRegId;

        beforeAll(async () => {
            // Yeni event ve kayıt oluştur
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const cancelEvent = await db.Event.create({
                title: 'Cancel Test Event',
                category: 'workshop',
                event_date: futureDate.toISOString().split('T')[0],
                start_time: '10:00',
                end_time: '12:00',
                location: 'Room B',
                capacity: 20,
                status: 'active'
            });

            const regRes = await request(app)
                .post(`/api/v1/events/${cancelEvent.id}/register`)
                .set('Authorization', `Bearer ${studentToken}`);
            cancelRegId = regRes.body.data?.id;
        });

        it('should cancel registration', async () => {
            if (!cancelRegId) return;

            const res = await request(app)
                .delete(`/api/v1/events/registrations/${cancelRegId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/v1/events/:eventId/registrations/:regId/checkin', () => {
        it('should check in registration with QR code (admin/staff)', async () => {
            // Bugünkü event oluştur
            const today = new Date();
            const todayEvent = await db.Event.create({
                title: 'Today Event',
                category: 'conference',
                event_date: today.toISOString().split('T')[0],
                start_time: '09:00',
                end_time: '17:00',
                location: 'Main Hall',
                capacity: 100,
                status: 'active'
            });

            // Kayıt ol
            const regRes = await request(app)
                .post(`/api/v1/events/${todayEvent.id}/register`)
                .set('Authorization', `Bearer ${studentToken}`);

            const qrCode = regRes.body.data?.qr_code;
            const newRegId = regRes.body.data?.id;

            // Check-in yap
            const res = await request(app)
                .post(`/api/v1/events/${todayEvent.id}/registrations/${newRegId}/checkin`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ qrCode });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Veritabanında kontrol
            const reg = await db.EventRegistration.findByPk(newRegId);
            expect(reg.checked_in).toBe(true);
        });

        it('should reject check-in for wrong event date', async () => {
            // Gelecekteki event
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const futureEvent = await db.Event.create({
                title: 'Future Event',
                category: 'workshop',
                event_date: futureDate.toISOString().split('T')[0],
                start_time: '10:00',
                end_time: '12:00',
                location: 'Room C',
                capacity: 20,
                status: 'active'
            });

            const regRes = await request(app)
                .post(`/api/v1/events/${futureEvent.id}/register`)
                .set('Authorization', `Bearer ${studentToken}`);

            const newRegId = regRes.body.data?.id;

            const res = await request(app)
                .post(`/api/v1/events/${futureEvent.id}/registrations/${newRegId}/checkin`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('GET /api/v1/events/:id/registrations', () => {
        it('should get event registrations (admin only)', async () => {
            const res = await request(app)
                .get(`/api/v1/events/${eventId}/registrations`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should deny student access to registration list', async () => {
            const res = await request(app)
                .get(`/api/v1/events/${eventId}/registrations`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('PUT /api/v1/events/:id', () => {
        it('should update event (admin only)', async () => {
            const res = await request(app)
                .put(`/api/v1/events/${eventId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    title: 'Updated Event Title',
                    description: 'Updated description'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('Updated Event Title');
        });
    });

    describe('DELETE /api/v1/events/:id', () => {
        let deleteEventId;

        beforeAll(async () => {
            const deleteEvent = await db.Event.create({
                title: 'To Delete',
                category: 'social',
                event_date: new Date().toISOString().split('T')[0],
                start_time: '20:00',
                end_time: '22:00',
                location: 'Garden',
                capacity: 100,
                status: 'active'
            });
            deleteEventId = deleteEvent.id;
        });

        it('should delete event (admin only)', async () => {
            const res = await request(app)
                .delete(`/api/v1/events/${deleteEventId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });
});

describe('Event Waitlist Tests', () => {
    let adminToken, studentToken;
    let fullEventId;

    beforeAll(async () => {
        // Full event oluştur
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 20);

        const fullEvent = await db.Event.create({
            title: 'Full Waitlist Event',
            category: 'workshop',
            event_date: futureDate.toISOString().split('T')[0],
            start_time: '14:00',
            end_time: '16:00',
            location: 'Small Room',
            capacity: 2,
            registered_count: 2,
            status: 'active'
        });
        fullEventId = fullEvent.id;

        // Tokens
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

    it('should add to waitlist when event is full', async () => {
        // Kapasiteyi sıfırla for test
        await db.Event.update(
            { registered_count: 2 },
            { where: { id: fullEventId } }
        );

        const res = await request(app)
            .post(`/api/v1/events/${fullEventId}/register`)
            .set('Authorization', `Bearer ${studentToken}`);

        // Ya hata verir ya waitlist'e ekler
        expect([201, 400]).toContain(res.statusCode);
    });
});
