const express = require('express');
const {
  getEvents, getEventDetail, createEvent, updateEvent, deleteEvent, getEventRegistrations,
  registerEvent, getMyEvents, cancelRegistration, checkInEvent,
  // Waitlist functions
  joinWaitlist, leaveWaitlist, getWaitlistPosition, getEventWaitlist, getMyWaitlist, acceptWaitlistSpot
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Public routes (authenticated users)
router.get('/', protect, getEvents);
router.get('/my-events', protect, getMyEvents);
router.get('/my-waitlist', protect, getMyWaitlist); // NEW: Get user's waitlisted events
router.post('/checkin', protect, authorize('staff', 'admin'), checkInEvent); // Part 3: QR kod ile check-in (spesifik route önce)

// Waitlist routes (authenticated users)
router.post('/:eventId/waitlist', protect, joinWaitlist); // Join waitlist
router.delete('/:eventId/waitlist', protect, leaveWaitlist); // Leave waitlist
router.get('/:eventId/waitlist/position', protect, getWaitlistPosition); // Get my position
router.post('/:eventId/waitlist/accept', protect, acceptWaitlistSpot); // Accept spot when notified

router.get('/:id', protect, getEventDetail);
router.post('/:eventId/register', protect, registerEvent);
router.delete('/registrations/:id', protect, cancelRegistration);

// Admin/Staff routes
router.post('/', protect, authorize('admin', 'staff'), createEvent);
router.put('/:id', protect, authorize('admin', 'staff'), updateEvent);
router.delete('/:id', protect, authorize('admin', 'staff'), deleteEvent);
router.get('/:eventId/registrations', protect, authorize('admin', 'staff'), getEventRegistrations);
router.get('/:eventId/waitlist', protect, authorize('admin', 'staff'), getEventWaitlist); // Get event waitlist (admin)
router.post('/:eventId/registrations/:registrationId/checkin', protect, authorize('staff', 'admin'), checkInEvent); // Part 3: ID ile check-in

module.exports = router;
