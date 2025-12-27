const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAllEquipment, borrowEquipment, returnEquipment, createEquipment, deleteEquipment, updateEquipment } = require('../controllers/equipmentController');
const router = express.Router();

router.get('/', protect, getAllEquipment);
router.post('/', protect, authorize('admin'), createEquipment); // Yeni: Ekipman ekleme
router.post('/borrow', protect, borrowEquipment);
router.post('/return', protect, authorize('staff', 'admin'), returnEquipment);
router.put('/:id', protect, authorize('admin'), updateEquipment); // Yeni: Ekipman güncelleme
router.delete('/:id', protect, authorize('admin'), deleteEquipment); // Yeni: Ekipman silme

module.exports = router;