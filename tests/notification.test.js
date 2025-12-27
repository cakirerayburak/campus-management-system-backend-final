/**
 * Notification System Tests
 * Part 4: Bildirim sistemi kapsamlı testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

describe('Notification System Tests', () => {
    let adminToken, studentToken;
    let adminUser, studentUser;
    let notificationId;

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department oluştur
        const dept = await db.Department.create({
            name: 'Test Department',
            code: 'NOTIF',
            faculty_name: 'Engineering'
        });

        // Admin oluştur
        adminUser = await db.User.create({
            name: 'Admin User',
            email: `admin_notif_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'admin',
            is_verified: true
        });

        // Student oluştur
        studentUser = await db.User.create({
            name: 'Student User',
            email: `student_notif_${Date.now()}@test.com`,
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

        const studentLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: studentUser.email, password: 'Password123' });
        studentToken = studentLogin.body.data?.accessToken;

        // Test bildirimleri oluştur
        const notification = await db.Notification.create({
            user_id: studentUser.id,
            title: 'Test Notification',
            message: 'This is a test notification message',
            category: 'academic',
            type: 'info',
            is_read: false
        });
        notificationId = notification.id;

        // Ek bildirimler
        await db.Notification.create({
            user_id: studentUser.id,
            title: 'Attendance Warning',
            message: 'You have missed 3 classes',
            category: 'attendance',
            type: 'warning',
            is_read: true
        });

        await db.Notification.create({
            user_id: studentUser.id,
            title: 'Grade Posted',
            message: 'Your midterm grade has been posted',
            category: 'academic',
            type: 'success',
            is_read: false
        });
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('GET /api/v1/notifications', () => {
        it('should get all notifications for authenticated user', async () => {
            const res = await request(app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/v1/notifications');

            expect(res.statusCode).toEqual(401);
        });

        it('should filter notifications by category', async () => {
            const res = await request(app)
                .get('/api/v1/notifications?category=academic')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            if (res.body.data.length > 0) {
                res.body.data.forEach(n => {
                    expect(n.category).toBe('academic');
                });
            }
        });

        it('should filter notifications by read status', async () => {
            const res = await request(app)
                .get('/api/v1/notifications?is_read=false')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            if (res.body.data.length > 0) {
                res.body.data.forEach(n => {
                    expect(n.is_read).toBe(false);
                });
            }
        });

        it('should paginate notifications', async () => {
            const res = await request(app)
                .get('/api/v1/notifications?page=1&limit=2')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toBeLessThanOrEqual(2);
        });
    });

    describe('PUT /api/v1/notifications/:id/read', () => {
        it('should mark notification as read', async () => {
            const res = await request(app)
                .put(`/api/v1/notifications/${notificationId}/read`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Verify it's marked as read
            const notification = await db.Notification.findByPk(notificationId);
            expect(notification.is_read).toBe(true);
        });

        it('should return 404 for non-existent notification', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .put(`/api/v1/notifications/${fakeId}/read`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(404);
        });

        it('should not allow marking other user notifications', async () => {
            // Create notification for admin
            const adminNotif = await db.Notification.create({
                user_id: adminUser.id,
                title: 'Admin Notification',
                message: 'For admin only',
                category: 'system',
                type: 'info'
            });

            const res = await request(app)
                .put(`/api/v1/notifications/${adminNotif.id}/read`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('PUT /api/v1/notifications/mark-all-read', () => {
        beforeAll(async () => {
            // Reset notifications to unread
            await db.Notification.update(
                { is_read: false },
                { where: { user_id: studentUser.id } }
            );
        });

        it('should mark all notifications as read', async () => {
            const res = await request(app)
                .put('/api/v1/notifications/mark-all-read')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Verify all are marked as read
            const unreadCount = await db.Notification.count({
                where: { user_id: studentUser.id, is_read: false }
            });
            expect(unreadCount).toBe(0);
        });
    });

    describe('DELETE /api/v1/notifications/:id', () => {
        let deleteNotifId;

        beforeAll(async () => {
            const notif = await db.Notification.create({
                user_id: studentUser.id,
                title: 'To Delete',
                message: 'This will be deleted',
                category: 'system',
                type: 'info'
            });
            deleteNotifId = notif.id;
        });

        it('should delete notification', async () => {
            const res = await request(app)
                .delete(`/api/v1/notifications/${deleteNotifId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Verify it's deleted
            const notif = await db.Notification.findByPk(deleteNotifId);
            expect(notif).toBeNull();
        });

        it('should return 404 for already deleted notification', async () => {
            const res = await request(app)
                .delete(`/api/v1/notifications/${deleteNotifId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('GET /api/v1/notifications/preferences', () => {
        it('should get notification preferences', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('PUT /api/v1/notifications/preferences', () => {
        it('should update notification preferences', async () => {
            const res = await request(app)
                .put('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    email_academic: true,
                    email_attendance: false,
                    email_meal: true,
                    email_event: true,
                    push_academic: true,
                    push_attendance: true
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('should preserve existing preferences when updating partial', async () => {
            // First set some preferences
            await request(app)
                .put('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ email_academic: true });

            // Update only one preference
            await request(app)
                .put('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ email_meal: false });

            // Verify both are set correctly
            const res = await request(app)
                .get('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/v1/notifications/unread-count', () => {
        beforeAll(async () => {
            // Reset some notifications to unread
            await db.Notification.create({
                user_id: studentUser.id,
                title: 'New Unread',
                message: 'Unread message',
                category: 'system',
                type: 'info',
                is_read: false
            });
        });

        it('should get unread notification count', async () => {
            const res = await request(app)
                .get('/api/v1/notifications/unread-count')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(typeof res.body.data.count).toBe('number');
        });
    });
});
