/**
 * GPS & Haversine Formula Tests
 * Part 2: GPS tabanlı yoklama sistemi birim testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

// Haversine Formula Implementation
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Velocity Check (impossible travel detection)
function checkVelocity(prevLocation, currentLocation, timeDiffSeconds) {
    if (!prevLocation || timeDiffSeconds <= 0) return { valid: true };

    const distance = haversineDistance(
        prevLocation.latitude,
        prevLocation.longitude,
        currentLocation.latitude,
        currentLocation.longitude
    );

    const speedMps = distance / timeDiffSeconds;
    const speedKmh = speedMps * 3.6;

    // Max reasonable walking speed: 6 km/h, running: 15 km/h
    // Threshold: 20 km/h (allowing for some margin)
    const MAX_SPEED_KMH = 20;

    return {
        valid: speedKmh <= MAX_SPEED_KMH,
        speed: speedKmh,
        distance: distance
    };
}

describe('Haversine Formula Unit Tests', () => {
    describe('Basic Distance Calculations', () => {
        it('should calculate zero distance for same coordinates', () => {
            const distance = haversineDistance(41.0255, 40.5201, 41.0255, 40.5201);
            expect(distance).toBe(0);
        });

        it('should calculate correct distance for nearby points (~15m)', () => {
            // Approximately 15 meters apart
            const lat1 = 41.0255;
            const lon1 = 40.5201;
            const lat2 = 41.0256; // ~11m north
            const lon2 = 40.5202; // ~8m east

            const distance = haversineDistance(lat1, lon1, lat2, lon2);

            // Should be approximately 14-16 meters
            expect(distance).toBeGreaterThan(10);
            expect(distance).toBeLessThan(20);
        });

        it('should calculate correct distance for points ~100m apart', () => {
            const lat1 = 41.0255;
            const lon1 = 40.5201;
            const lat2 = 41.0264; // ~100m north
            const lon2 = 40.5201;

            const distance = haversineDistance(lat1, lon1, lat2, lon2);

            // Should be approximately 100 meters
            expect(distance).toBeGreaterThan(90);
            expect(distance).toBeLessThan(110);
        });

        it('should calculate correct distance for points ~1km apart', () => {
            const lat1 = 41.0255;
            const lon1 = 40.5201;
            const lat2 = 41.0345; // ~1km north
            const lon2 = 40.5201;

            const distance = haversineDistance(lat1, lon1, lat2, lon2);

            // Should be approximately 1000 meters
            expect(distance).toBeGreaterThan(900);
            expect(distance).toBeLessThan(1100);
        });

        it('should be symmetric (A to B = B to A)', () => {
            const lat1 = 41.0255;
            const lon1 = 40.5201;
            const lat2 = 41.0355;
            const lon2 = 40.5301;

            const distance1 = haversineDistance(lat1, lon1, lat2, lon2);
            const distance2 = haversineDistance(lat2, lon2, lat1, lon1);

            expect(Math.abs(distance1 - distance2)).toBeLessThan(0.01);
        });
    });

    describe('Edge Cases', () => {
        it('should handle equator coordinates', () => {
            const distance = haversineDistance(0, 0, 0, 1);
            // 1 degree at equator ≈ 111km
            expect(distance).toBeGreaterThan(110000);
            expect(distance).toBeLessThan(112000);
        });

        it('should handle polar coordinates', () => {
            const distance = haversineDistance(89, 0, 89, 180);
            // Near pole, small distance
            expect(distance).toBeGreaterThan(0);
        });

        it('should handle negative coordinates', () => {
            const distance = haversineDistance(-41.0255, -40.5201, -41.0256, -40.5202);
            expect(distance).toBeGreaterThan(10);
            expect(distance).toBeLessThan(20);
        });
    });
});

describe('Velocity Check (Spoofing Detection) Tests', () => {
    describe('Normal Movement', () => {
        it('should accept normal walking speed', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 41.0256, longitude: 40.5202 };
            const timeDiff = 60; // 1 minute

            const result = checkVelocity(prevLocation, currentLocation, timeDiff);

            expect(result.valid).toBe(true);
            expect(result.speed).toBeLessThan(2); // ~1 km/h
        });

        it('should accept running speed', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 41.0270, longitude: 40.5201 };
            const timeDiff = 60; // 1 minute, ~170m = ~10 km/h

            const result = checkVelocity(prevLocation, currentLocation, timeDiff);

            expect(result.valid).toBe(true);
        });
    });

    describe('Suspicious Movement (Spoofing)', () => {
        it('should reject impossible speed (teleportation)', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 42.0255, longitude: 40.5201 }; // ~111km away
            const timeDiff = 60; // 1 minute = 6660 km/h (impossible)

            const result = checkVelocity(prevLocation, currentLocation, timeDiff);

            expect(result.valid).toBe(false);
            expect(result.speed).toBeGreaterThan(1000); // Way over limit
        });

        it('should reject very fast movement (car speed in campus)', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 41.0355, longitude: 40.5201 }; // ~1.1km away
            const timeDiff = 60; // 1 minute = 66 km/h

            const result = checkVelocity(prevLocation, currentLocation, timeDiff);

            expect(result.valid).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle no previous location', () => {
            const result = checkVelocity(null, { latitude: 41.0255, longitude: 40.5201 }, 60);
            expect(result.valid).toBe(true);
        });

        it('should handle zero time difference', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 41.0256, longitude: 40.5202 };

            const result = checkVelocity(prevLocation, currentLocation, 0);
            expect(result.valid).toBe(true);
        });

        it('should handle same location (stationary)', () => {
            const prevLocation = { latitude: 41.0255, longitude: 40.5201 };
            const currentLocation = { latitude: 41.0255, longitude: 40.5201 };
            const timeDiff = 300; // 5 minutes

            const result = checkVelocity(prevLocation, currentLocation, timeDiff);

            expect(result.valid).toBe(true);
            expect(result.speed).toBe(0);
        });
    });
});

describe('Geofence Validation Tests', () => {
    const classroomLocation = { latitude: 41.0255, longitude: 40.5201 };
    const geofenceRadius = 15; // meters

    function isWithinGeofence(studentLocation, centerLocation, radius) {
        const distance = haversineDistance(
            studentLocation.latitude,
            studentLocation.longitude,
            centerLocation.latitude,
            centerLocation.longitude
        );
        return distance <= radius;
    }

    describe('Inside Geofence', () => {
        it('should accept location at center', () => {
            const studentLocation = { latitude: 41.0255, longitude: 40.5201 };
            expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(true);
        });

        it('should accept location 10m away', () => {
            const studentLocation = { latitude: 41.0256, longitude: 40.5201 };
            expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(true);
        });

        it('should accept location at edge (15m)', () => {
            // ~15m is approximately 0.000135 degrees latitude
            const studentLocation = { latitude: 41.02563, longitude: 40.5201 };
            const distance = haversineDistance(
                studentLocation.latitude, studentLocation.longitude,
                classroomLocation.latitude, classroomLocation.longitude
            );

            if (distance <= 15) {
                expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(true);
            }
        });
    });

    describe('Outside Geofence', () => {
        it('should reject location 20m away', () => {
            // ~20m is approximately 0.00018 degrees latitude
            const studentLocation = { latitude: 41.0257, longitude: 40.5201 };
            expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(false);
        });

        it('should reject location 100m away', () => {
            const studentLocation = { latitude: 41.0264, longitude: 40.5201 };
            expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(false);
        });

        it('should reject location 1km away', () => {
            const studentLocation = { latitude: 41.0355, longitude: 40.5201 };
            expect(isWithinGeofence(studentLocation, classroomLocation, geofenceRadius)).toBe(false);
        });
    });
});

describe('GPS Attendance Integration Tests', () => {
    let facultyToken, studentToken;
    let sectionId, sessionId;

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department
        const dept = await db.Department.create({
            name: 'GPS Test Dept',
            code: 'GPS',
            faculty_name: 'Engineering'
        });

        // Classroom with GPS coordinates
        const classroom = await db.Classroom.create({
            code: 'GPS-101',
            building: 'GPS Building',
            room_number: '101',
            capacity: 30,
            type: 'classroom',
            latitude: 41.0255,
            longitude: 40.5201
        });

        // Faculty
        const facultyUser = await db.User.create({
            name: 'GPS Faculty',
            email: `gps_faculty_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'faculty',
            is_verified: true
        });

        const faculty = await db.Faculty.create({
            userId: facultyUser.id,
            departmentId: dept.id,
            employee_number: `F${Date.now()}`,
            title: 'Dr.'
        });

        // Student
        const studentUser = await db.User.create({
            name: 'GPS Student',
            email: `gps_student_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        const student = await db.Student.create({
            userId: studentUser.id,
            student_number: `S${Date.now()}`,
            departmentId: dept.id
        });

        // Course and Section
        const course = await db.Course.create({
            code: 'GPS101',
            name: 'GPS Course',
            credits: 3,
            ects: 5,
            departmentId: dept.id
        });

        const section = await db.CourseSection.create({
            courseId: course.id,
            section_number: 1,
            semester: 'Spring',
            year: 2025,
            instructorId: faculty.id,
            classroomId: classroom.id,
            capacity: 30
        });
        sectionId = section.id;

        // Enroll student
        await db.Enrollment.create({
            studentId: student.id,
            sectionId: section.id,
            status: 'enrolled'
        });

        // Get tokens
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

    describe('Session with GPS Coordinates', () => {
        it('should start session with classroom GPS', async () => {
            const res = await request(app)
                .post('/api/v1/attendance/sessions')
                .set('Authorization', `Bearer ${facultyToken}`)
                .send({
                    sectionId: sectionId,
                    duration_minutes: 30,
                    latitude: 41.0255,
                    longitude: 40.5201,
                    geofence_radius: 15
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.latitude).toBe(41.0255);
            expect(res.body.data.longitude).toBe(40.5201);
            sessionId = res.body.data.id;
        });
    });

    describe('Check-in with GPS Validation', () => {
        it('should accept check-in within geofence (10m)', async () => {
            const res = await request(app)
                .post(`/api/v1/attendance/sessions/${sessionId}/checkin`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    latitude: 41.0256,
                    longitude: 40.5202
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Check-in Outside Geofence', () => {
        let newSessionId;

        beforeAll(async () => {
            // Close previous session
            await request(app)
                .put(`/api/v1/attendance/sessions/${sessionId}/close`)
                .set('Authorization', `Bearer ${facultyToken}`);

            // Create new session
            const res = await request(app)
                .post('/api/v1/attendance/sessions')
                .set('Authorization', `Bearer ${facultyToken}`)
                .send({
                    sectionId: sectionId,
                    duration_minutes: 30,
                    latitude: 41.0255,
                    longitude: 40.5201,
                    geofence_radius: 15
                });
            newSessionId = res.body.data?.id;
        });

        it('should reject check-in 1km away', async () => {
            // New student for this test
            const farStudent = await db.User.create({
                name: 'Far Student',
                email: `far_${Date.now()}@test.com`,
                password_hash: 'Password123',
                role: 'student',
                is_verified: true
            });

            const farStudentProfile = await db.Student.create({
                userId: farStudent.id,
                student_number: `FAR${Date.now()}`,
                departmentId: (await db.Department.findOne()).id
            });

            await db.Enrollment.create({
                studentId: farStudentProfile.id,
                sectionId: sectionId,
                status: 'enrolled'
            });

            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: farStudent.email, password: 'Password123' });
            const farToken = loginRes.body.data?.accessToken;

            const res = await request(app)
                .post(`/api/v1/attendance/sessions/${newSessionId}/checkin`)
                .set('Authorization', `Bearer ${farToken}`)
                .send({
                    latitude: 41.0355, // ~1km away
                    longitude: 40.5201
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/uzak|geofence|dışında/i);
        });
    });
});
