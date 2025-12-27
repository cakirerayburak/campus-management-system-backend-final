/**
 * Business Logic Unit Tests
 * Kritik iş mantığı servislerinin birim testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

// ============================================================================
// PREREQUISITE SERVICE TESTS
// ============================================================================
describe('Prerequisite Checking Service', () => {
    let studentId, departmentId;
    let course1Id, course2Id, course3Id; // Chain: 1 -> 2 -> 3

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department
        const dept = await db.Department.create({
            name: 'Prerequisite Test Dept',
            code: 'PREREQ',
            faculty_name: 'Engineering'
        });
        departmentId = dept.id;

        // Student
        const studentUser = await db.User.create({
            name: 'Prereq Student',
            email: `prereq_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        const student = await db.Student.create({
            userId: studentUser.id,
            student_number: `P${Date.now()}`,
            departmentId: dept.id
        });
        studentId = student.id;

        // Course chain: Course1 (no prereq) -> Course2 -> Course3
        const course1 = await db.Course.create({
            code: 'PREREQ101',
            name: 'Introduction',
            credits: 3,
            ects: 5,
            departmentId: dept.id,
            prerequisiteId: null
        });
        course1Id = course1.id;

        const course2 = await db.Course.create({
            code: 'PREREQ201',
            name: 'Intermediate',
            credits: 3,
            ects: 5,
            departmentId: dept.id,
            prerequisiteId: course1.id
        });
        course2Id = course2.id;

        const course3 = await db.Course.create({
            code: 'PREREQ301',
            name: 'Advanced',
            credits: 3,
            ects: 5,
            departmentId: dept.id,
            prerequisiteId: course2.id
        });
        course3Id = course3.id;
    });

    afterAll(async () => {
        // Bağlantıyı kapatma - dosya sonunda yapılacak
    });

    describe('checkPrerequisites Function', () => {
        // Simulate prerequisite checking logic
        async function checkPrerequisites(courseId, studentId) {
            const course = await db.Course.findByPk(courseId);
            if (!course) throw new Error('Ders bulunamadı');

            const prerequisiteId = course.prerequisiteId;
            if (!prerequisiteId) return { satisfied: true, missing: [] };

            const missing = [];
            let currentPrereqId = prerequisiteId;

            while (currentPrereqId) {
                const prereqCourse = await db.Course.findByPk(currentPrereqId);
                if (!prereqCourse) break;

                // Check if student passed this course
                const passed = await db.Enrollment.findOne({
                    where: {
                        studentId: studentId,
                        status: 'passed'
                    },
                    include: [{
                        model: db.CourseSection,
                        as: 'section',
                        where: { courseId: currentPrereqId }
                    }]
                });

                if (!passed) {
                    missing.push({
                        code: prereqCourse.code,
                        name: prereqCourse.name
                    });
                }

                currentPrereqId = prereqCourse.prerequisiteId;
            }

            return {
                satisfied: missing.length === 0,
                missing: missing
            };
        }

        it('should return satisfied for course without prerequisite', async () => {
            const result = await checkPrerequisites(course1Id, studentId);
            expect(result.satisfied).toBe(true);
            expect(result.missing.length).toBe(0);
        });

        it('should return not satisfied when prerequisite not passed', async () => {
            const result = await checkPrerequisites(course2Id, studentId);
            expect(result.satisfied).toBe(false);
            expect(result.missing.length).toBeGreaterThan(0);
            expect(result.missing[0].code).toBe('PREREQ101');
        });

        it('should return not satisfied for chained prerequisites', async () => {
            const result = await checkPrerequisites(course3Id, studentId);
            expect(result.satisfied).toBe(false);
            // Should have both PREREQ101 and PREREQ201 in missing
            expect(result.missing.length).toBe(2);
        });

        it('should return satisfied after passing prerequisite', async () => {
            const faculty = await db.Faculty.create({
                userId: (await db.User.create({
                    name: 'Prereq Faculty',
                    email: `prereq_fac_${Date.now()}@test.com`,
                    password_hash: 'Password123',
                    role: 'faculty',
                    is_verified: true
                })).id,
                departmentId: departmentId,
                employee_number: `F${Date.now()}`,
                title: 'Dr.'
            });

            const classroom = await db.Classroom.create({
                code: 'PREREQ-101',
                building: 'Test',
                room_number: '101',
                capacity: 30
            });

            // Create section for course1
            const section1 = await db.CourseSection.create({
                courseId: course1Id,
                section_number: 1,
                semester: 'Fall',
                year: 2024,
                instructorId: faculty.id,
                classroomId: classroom.id,
                capacity: 30
            });

            // Pass course1
            await db.Enrollment.create({
                studentId: studentId,
                sectionId: section1.id,
                status: 'passed',
                letter_grade: 'BB',
                grade_point: 3.0
            });

            // Now check course2
            const result = await checkPrerequisites(course2Id, studentId);
            expect(result.satisfied).toBe(true);
        });
    });
});

// ============================================================================
// SCHEDULE CONFLICT DETECTION TESTS
// ============================================================================
describe('Schedule Conflict Detection Service', () => {
    // Time overlap detection function
    function hasTimeOverlap(schedule1, schedule2) {
        if (schedule1.day !== schedule2.day) return false;

        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const start1 = toMinutes(schedule1.start_time);
        const end1 = toMinutes(schedule1.end_time);
        const start2 = toMinutes(schedule2.start_time);
        const end2 = toMinutes(schedule2.end_time);

        return !(end1 <= start2 || end2 <= start1);
    }

    function checkConflict(existingSchedules, newSchedule) {
        const conflicts = existingSchedules.filter(existing =>
            hasTimeOverlap(existing, newSchedule)
        );
        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts
        };
    }

    describe('Time Overlap Detection', () => {
        it('should detect overlap when times intersect', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '10:40' };
            const schedule2 = { day: 'Monday', start_time: '10:00', end_time: '11:40' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(true);
        });

        it('should not detect overlap for adjacent times', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '10:00' };
            const schedule2 = { day: 'Monday', start_time: '10:00', end_time: '11:00' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(false);
        });

        it('should not detect overlap for different days', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '10:40' };
            const schedule2 = { day: 'Tuesday', start_time: '09:00', end_time: '10:40' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(false);
        });

        it('should detect complete overlap', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '12:00' };
            const schedule2 = { day: 'Monday', start_time: '10:00', end_time: '11:00' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(true);
        });

        it('should detect overlap at start', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '10:00' };
            const schedule2 = { day: 'Monday', start_time: '08:30', end_time: '09:30' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(true);
        });

        it('should detect overlap at end', () => {
            const schedule1 = { day: 'Monday', start_time: '09:00', end_time: '10:00' };
            const schedule2 = { day: 'Monday', start_time: '09:30', end_time: '10:30' };

            expect(hasTimeOverlap(schedule1, schedule2)).toBe(true);
        });
    });

    describe('Student Schedule Conflict Check', () => {
        it('should find no conflict for empty schedule', () => {
            const existingSchedules = [];
            const newSchedule = { day: 'Monday', start_time: '09:00', end_time: '10:40' };

            const result = checkConflict(existingSchedules, newSchedule);
            expect(result.hasConflict).toBe(false);
        });

        it('should find conflict with existing course', () => {
            const existingSchedules = [
                { day: 'Monday', start_time: '09:00', end_time: '10:40', course: 'COMP101' },
                { day: 'Wednesday', start_time: '14:00', end_time: '15:40', course: 'MATH201' }
            ];
            const newSchedule = { day: 'Monday', start_time: '10:00', end_time: '11:40' };

            const result = checkConflict(existingSchedules, newSchedule);
            expect(result.hasConflict).toBe(true);
            expect(result.conflicts.length).toBe(1);
        });

        it('should find multiple conflicts', () => {
            const existingSchedules = [
                { day: 'Monday', start_time: '09:00', end_time: '10:40', course: 'COMP101' },
                { day: 'Monday', start_time: '10:00', end_time: '11:40', course: 'COMP102' }
            ];
            const newSchedule = { day: 'Monday', start_time: '09:30', end_time: '11:00' };

            const result = checkConflict(existingSchedules, newSchedule);
            expect(result.hasConflict).toBe(true);
            expect(result.conflicts.length).toBe(2);
        });
    });
});

// ============================================================================
// GRADE CALCULATION TESTS
// ============================================================================
describe('Grade Calculation Service', () => {
    function calculateLetterGrade(midterm, final) {
        const average = midterm * 0.4 + final * 0.6;

        if (average >= 90) return { letter: 'AA', point: 4.0 };
        if (average >= 85) return { letter: 'BA', point: 3.5 };
        if (average >= 80) return { letter: 'BB', point: 3.0 };
        if (average >= 75) return { letter: 'CB', point: 2.5 };
        if (average >= 70) return { letter: 'CC', point: 2.0 };
        if (average >= 65) return { letter: 'DC', point: 1.5 };
        if (average >= 60) return { letter: 'DD', point: 1.0 };
        if (average >= 55) return { letter: 'FD', point: 0.5 };
        return { letter: 'FF', point: 0.0 };
    }

    function calculateGPA(enrollments) {
        if (enrollments.length === 0) return 0;

        let totalPoints = 0;
        let totalCredits = 0;

        enrollments.forEach(e => {
            totalPoints += e.grade_point * e.credits;
            totalCredits += e.credits;
        });

        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0;
    }

    describe('Letter Grade Calculation', () => {
        it('should calculate AA for 90+ average', () => {
            const result = calculateLetterGrade(90, 92);
            expect(result.letter).toBe('AA');
            expect(result.point).toBe(4.0);
        });

        it('should calculate BA for 85-89 average', () => {
            const result = calculateLetterGrade(85, 90); // 88
            expect(result.letter).toBe('BA');
            expect(result.point).toBe(3.5);
        });

        it('should calculate BB for 80-84 average', () => {
            const result = calculateLetterGrade(80, 82); // 81.2
            expect(result.letter).toBe('BB');
            expect(result.point).toBe(3.0);
        });

        it('should calculate CC for 70-74 average', () => {
            const result = calculateLetterGrade(70, 72); // 71.2
            expect(result.letter).toBe('CC');
            expect(result.point).toBe(2.0);
        });

        it('should calculate FF for <55 average', () => {
            const result = calculateLetterGrade(40, 50); // 46
            expect(result.letter).toBe('FF');
            expect(result.point).toBe(0.0);
        });

        it('should handle weighted average correctly', () => {
            // midterm: 100, final: 80 -> 100*0.4 + 80*0.6 = 40 + 48 = 88 -> BA
            const result = calculateLetterGrade(100, 80);
            expect(result.letter).toBe('BA');
        });
    });

    describe('GPA Calculation', () => {
        it('should calculate correct GPA', () => {
            const enrollments = [
                { grade_point: 4.0, credits: 3 }, // AA
                { grade_point: 3.0, credits: 3 }, // BB
                { grade_point: 3.5, credits: 4 }  // BA
            ];
            // (4*3 + 3*3 + 3.5*4) / (3+3+4) = (12 + 9 + 14) / 10 = 35/10 = 3.5
            const gpa = calculateGPA(enrollments);
            expect(parseFloat(gpa)).toBe(3.50);
        });

        it('should return 0 for no enrollments', () => {
            const gpa = calculateGPA([]);
            expect(gpa).toBe(0);
        });

        it('should handle single enrollment', () => {
            const enrollments = [{ grade_point: 3.0, credits: 3 }];
            const gpa = calculateGPA(enrollments);
            expect(parseFloat(gpa)).toBe(3.00);
        });
    });
});

// ============================================================================
// CAPACITY CONTROL TESTS
// ============================================================================
describe('Capacity Control Service', () => {
    describe('Atomic Enrollment', () => {
        let sectionId;

        beforeAll(async () => {
            await db.sequelize.sync({ force: true });

            const dept = await db.Department.create({
                name: 'Capacity Test Dept',
                code: 'CAP',
                faculty_name: 'Engineering'
            });

            const course = await db.Course.create({
                code: 'CAP101',
                name: 'Capacity Test Course',
                credits: 3,
                ects: 5,
                departmentId: dept.id
            });

            const facultyUser = await db.User.create({
                name: 'Cap Faculty',
                email: `cap_fac_${Date.now()}@test.com`,
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

            const classroom = await db.Classroom.create({
                code: 'CAP-101',
                building: 'Test',
                room_number: '101',
                capacity: 30
            });

            const section = await db.CourseSection.create({
                courseId: course.id,
                section_number: 1,
                semester: 'Spring',
                year: 2025,
                instructorId: faculty.id,
                classroomId: classroom.id,
                capacity: 2, // Small capacity for testing
                enrolled_count: 0
            });
            sectionId = section.id;
        });

        afterAll(async () => {
            // Bağlantıyı kapatma - dosya sonunda yapılacak
        });

        it('should allow enrollment when capacity available', async () => {
            const [affectedRows] = await db.CourseSection.update(
                { enrolled_count: db.sequelize.literal('enrolled_count + 1') },
                {
                    where: {
                        id: sectionId,
                        enrolled_count: { [db.Sequelize.Op.lt]: db.sequelize.col('capacity') }
                    }
                }
            );

            expect(affectedRows).toBe(1);
        });

        it('should increment enrolled_count correctly', async () => {
            const section = await db.CourseSection.findByPk(sectionId);
            expect(section.enrolled_count).toBe(1);
        });

        it('should not allow enrollment when at capacity', async () => {
            // Fill to capacity
            await db.CourseSection.update(
                { enrolled_count: 2 },
                { where: { id: sectionId } }
            );

            const [affectedRows] = await db.CourseSection.update(
                { enrolled_count: db.sequelize.literal('enrolled_count + 1') },
                {
                    where: {
                        id: sectionId,
                        enrolled_count: { [db.Sequelize.Op.lt]: db.sequelize.col('capacity') }
                    }
                }
            );

            expect(affectedRows).toBe(0);
        });
    });
});

// ============================================================================
// QR CODE SERVICE TESTS
// ============================================================================
describe('QR Code Service Tests', () => {
    const qrCodeService = require('../src/services/qrCodeService');

    describe('generateQRCode', () => {
        it('should generate QR code from string data', async () => {
            const data = 'test-token-123';
            const result = await qrCodeService.generateQRCode(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            // Should be base64 data URL
            expect(result.startsWith('data:image/png;base64,')).toBe(true);
        });

        it('should generate QR code from object data', async () => {
            const data = { userId: '123', eventId: '456', token: 'abc' };
            const result = await qrCodeService.generateQRCode(data);

            expect(result).toBeDefined();
            expect(result.startsWith('data:image/png;base64,')).toBe(true);
        });
    });

    describe('generateToken', () => {
        it('should generate unique token', () => {
            const token1 = qrCodeService.generateToken();
            const token2 = qrCodeService.generateToken();

            expect(token1).not.toBe(token2);
            expect(token1.length).toBeGreaterThan(0);
        });

        it('should add prefix to token', () => {
            const token = qrCodeService.generateToken('MEAL');
            expect(token.startsWith('MEAL_')).toBe(true);
        });
    });

    describe('parseQRData', () => {
        it('should parse JSON string', () => {
            const data = '{"u":"user123","m":"menu456","r":"token789"}';
            const result = qrCodeService.parseQRData(data);

            expect(result.u).toBe('user123');
            expect(result.m).toBe('menu456');
            expect(result.token).toBe('token789');
        });

        it('should handle plain token string', () => {
            const data = 'simple-token-123';
            const result = qrCodeService.parseQRData(data);

            expect(result.token).toBe('simple-token-123');
        });
    });
});
