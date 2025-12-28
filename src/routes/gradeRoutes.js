const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const enrollmentController = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Student routes
router.get('/my-grades', authorize('student'), gradeController.getMyGrades);
router.get('/summary', authorize('student'), gradeController.getGradeSummary);
router.get('/semester/:semester/:year', authorize('student'), gradeController.getSemesterGPA);
router.get('/transcript/pdf', authorize('student'), gradeController.downloadTranscript);

// Faculty routes - Not girişi
router.put('/:enrollmentId', authorize('faculty', 'admin'), gradeController.updateGrade);
router.get('/section/:sectionId', authorize('faculty', 'admin'), enrollmentController.getStudentsBySection);

// Admin routes
router.get('/all', authorize('admin'), gradeController.getAllGrades);

module.exports = router;
