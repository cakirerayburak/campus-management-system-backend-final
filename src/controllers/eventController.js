const { Event, EventRegistration, EventWaitlist, sequelize, User } = require('../models');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const qrCodeService = require('../services/qrCodeService');
const notificationService = require('../services/notificationService');


exports.getEvents = async (req, res) => {
  try {
    const { category, date, search, page = 1, limit = 10 } = req.query;
    const whereClause = { status: 'active' }; // Sadece aktif etkinlikler

    // Filter by category
    if (category) {
      whereClause.category = category;
    }

    // Filter by date
    if (date) {
      whereClause.date = { [Op.gte]: date }; // Bu tarihten sonraki etkinlikler
    }

    // Search by title
    if (search) {
      whereClause.title = { [Op.iLike]: `%${search}%` };
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: events } = await Event.findAndCountAll({
      where: whereClause,
      order: [['date', 'ASC'], ['start_time', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: events,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Detayı
exports.getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id, {
      include: [{
        model: EventRegistration,
        attributes: ['id', 'user_id', 'checked_in'],
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      }]
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// YENİ: Etkinlik Oluşturma (Admin)
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Check-in (Görevli) - QR kod ile
exports.checkInEvent = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params; // Route parametreleri (opsiyonel)
    const { qrCode } = req.body; // QR kod string'i

    let registration;

    // Eğer route /events/checkin ise (eventId ve registrationId yok), direkt QR kod ile ara
    if (!eventId || !registrationId) {
      // QR kod ile check-in (route: /events/checkin)
      if (!qrCode) {
        return res.status(400).json({ success: false, message: 'QR kod gerekli.' });
      }

      // QR kod parse et
      let qrData;
      try {
        qrData = qrCodeService.parseQRData(qrCode);
      } catch (error) {
        console.error('QR kod parse hatası:', error);
        return res.status(400).json({ success: false, message: 'Geçersiz QR kod formatı.' });
      }

      // QR kod formatı: {"u":"userId","e":"eventId","r":"token","type":"event"}
      // Token'ı bul: önce r, sonra token
      const qrToken = qrData.r || qrData.token || qrCode;
      const qrEventId = qrData.e || qrData.eventId;

      console.log('Event QR kod parse edildi:', { qrData, qrToken, qrEventId }); // Debug için

      // Rezervasyonu bul (QR token ile)
      const whereClause = {
        qr_code: qrToken,
        checked_in: false
      };

      // Eğer QR kod'da eventId varsa, onu da kullan
      if (qrEventId) {
        whereClause.event_id = qrEventId;
      }

      registration = await EventRegistration.findOne({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }, {
          model: Event
        }]
      });

      if (!registration) {
        console.log('Event kaydı bulunamadı. Token:', qrToken, 'Event ID:', qrEventId, 'QR Code:', qrCode); // Debug için
      }
    } else {
      // ID ile check-in (route: /events/:eventId/registrations/:registrationId/checkin)
      if (qrCode) {
        // QR kod ile bul (eventId ile birlikte)
        const qrData = qrCodeService.parseQRData(qrCode);
        const qrToken = qrData.r || qrData.token || qrCode;

        registration = await EventRegistration.findOne({
          where: {
            qr_code: qrToken,
            event_id: eventId
          },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        });
      } else {
        // Registration ID ile bul
        registration = await EventRegistration.findOne({
          where: { id: registrationId, event_id: eventId },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        });
      }
    }

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    }

    if (registration.checked_in) {
      return res.status(400).json({ success: false, message: 'Zaten giriş yapılmış' });
    }

    await registration.update({
      checked_in: true,
      checked_in_at: new Date()
    });

    res.json({
      success: true,
      message: 'Giriş onaylandı',
      data: {
        user: registration.User,
        checkedInAt: registration.checked_in_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Kayıt İptali
exports.cancelRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id, {
      include: [{ model: Event }]
    });

    if (!registration) throw new Error('Kayıt bulunamadı');
    if (registration.user_id !== req.user.id) throw new Error('Yetkisiz işlem');

    // Check-in yapılmışsa iptal edilemez
    if (registration.checked_in) {
      throw new Error('Giriş yapılmış etkinlikler iptal edilemez');
    }

    const event = registration.Event;
    const eventId = event?.id;

    // Kaydı sil
    await registration.destroy({ transaction: t });

    // Sayacı azalt
    if (event) {
      await event.decrement('registered_count', { transaction: t });
    }

    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(req.user.id);
      if (user && event) {
        await notificationService.sendEventCancellation(user, event);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    // Trigger waitlist promotion if there's a waitlist
    if (eventId && event.waitlist_count > 0) {
      try {
        await exports.promoteNextInWaitlist(eventId, null);
      } catch (waitlistError) {
        console.error('Waitlist promotion error:', waitlistError);
      }
    }

    res.json({ success: true, message: 'Etkinlik kaydı iptal edildi.' });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};
exports.registerEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { eventId } = req.params;
    const { customFields } = req.body; // Custom fields (JSON)
    const userId = req.user.id;

    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Etkinlik bulunamadı');

    // Status kontrolü
    if (event.status !== 'active') {
      throw new Error('Bu etkinlik aktif değil');
    }

    // Registration deadline kontrolü
    if (event.registration_deadline) {
      const today = new Date().toISOString().split('T')[0];
      if (today > event.registration_deadline) {
        throw new Error('Kayıt son tarihi geçmiş');
      }
    }

    // Kontenjan kontrolü
    if (event.registered_count >= event.capacity) {
      throw new Error('Kontenjan dolu');
    }

    // Zaten kayıtlı mı kontrolü
    const existing = await EventRegistration.findOne({
      where: { event_id: eventId, user_id: userId },
      transaction: t
    });
    if (existing) throw new Error('Zaten kayıtlısınız');

    // QR Kod oluştur
    const qrToken = qrCodeService.generateToken('event');
    const qrData = { u: userId, e: eventId, r: qrToken, type: 'event' };
    const qrCode = await qrCodeService.generateQRCode(qrData);

    const registration = await EventRegistration.create({
      event_id: eventId,
      user_id: userId,
      qr_code: qrToken, // Token kaydediyoruz
      custom_fields_json: customFields || {}
    }, { transaction: t });

    // Sayaç artır (Atomic increment)
    await event.increment('registered_count', { transaction: t });

    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendEventRegistrationConfirmation(user, event, qrCode);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    res.status(201).json({
      success: true,
      data: {
        ...registration.toJSON(),
        qrCode // QR görseli frontend'e gönder
      }
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getMyEvents = async (req, res) => {
  try {
    const registrations = await EventRegistration.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Event }]
    });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Güncelleme
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });

    await event.update(req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Silme/İptal Etme
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });

    // Hard delete yerine status güncellemek daha güvenlidir
    await event.update({ status: 'cancelled' });

    // Opsiyonel: Katılımcılara bildirim gönder (NotificationService)

    res.json({ success: true, message: 'Etkinlik iptal edildi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinliğe Kayıtlı Kişileri Listeleme (Personel için)
exports.getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const registrations = await EventRegistration.findAll({
      where: { event_id: eventId },
      include: [
        {
          model: require('../models').User,
          attributes: ['id', 'name', 'email', 'student_number']
        }
      ]
    });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== WAITLIST FUNCTIONS ==============

// Join the waitlist for an event
exports.joinWaitlist = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Event not found');

    // Check if event is active
    if (event.status !== 'active') {
      throw new Error('This event is not active');
    }

    // Registration deadline check
    if (event.registration_deadline) {
      const today = new Date().toISOString().split('T')[0];
      if (today > event.registration_deadline) {
        throw new Error('Registration deadline has passed');
      }
    }

    // Check if already registered
    const existingRegistration = await EventRegistration.findOne({
      where: { event_id: eventId, user_id: userId }
    });
    if (existingRegistration) throw new Error('You are already registered for this event');

    // Check if already in waitlist
    const existingWaitlist = await EventWaitlist.findOne({
      where: {
        event_id: eventId,
        user_id: userId,
        status: { [Op.in]: ['waiting', 'notified'] }
      }
    });
    if (existingWaitlist) throw new Error('You are already on the waitlist');

    // Check if event is actually full (waitlist only makes sense when full)
    if (event.registered_count < event.capacity) {
      throw new Error('Event has available spots. Please register directly.');
    }

    // Get the next position in the waitlist
    const maxPosition = await EventWaitlist.max('position', {
      where: {
        event_id: eventId,
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      transaction: t
    });
    const nextPosition = (maxPosition || 0) + 1;

    // Create waitlist entry
    const waitlistEntry = await EventWaitlist.create({
      event_id: eventId,
      user_id: userId,
      position: nextPosition,
      status: 'waiting'
    }, { transaction: t });

    // Increment waitlist count
    await event.increment('waitlist_count', { transaction: t });

    await t.commit();

    // Send notification to user
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendWaitlistJoinConfirmation(user, event, nextPosition);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the waitlist',
      data: {
        id: waitlistEntry.id,
        position: nextPosition,
        event_title: event.title,
        joined_at: waitlistEntry.joined_at
      }
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// Leave the waitlist
exports.leaveWaitlist = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const waitlistEntry = await EventWaitlist.findOne({
      where: {
        event_id: eventId,
        user_id: userId,
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      include: [{ model: Event }]
    });

    if (!waitlistEntry) throw new Error('Waitlist entry not found');

    const leavingPosition = waitlistEntry.position;
    const event = waitlistEntry.Event;

    // Update status to cancelled
    await waitlistEntry.update({ status: 'cancelled' }, { transaction: t });

    // Decrease waitlist count
    if (event) {
      await event.decrement('waitlist_count', { transaction: t });
    }

    // Reorder positions for remaining waitlist entries
    await EventWaitlist.decrement('position', {
      by: 1,
      where: {
        event_id: eventId,
        position: { [Op.gt]: leavingPosition },
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      transaction: t
    });

    await t.commit();

    res.json({ success: true, message: 'Successfully left the waitlist' });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get user's waitlist position for an event
exports.getWaitlistPosition = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const waitlistEntry = await EventWaitlist.findOne({
      where: {
        event_id: eventId,
        user_id: userId,
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      include: [{ model: Event, attributes: ['id', 'title', 'waitlist_count'] }]
    });

    if (!waitlistEntry) {
      return res.json({
        success: true,
        data: null,
        message: 'Not on waitlist'
      });
    }

    res.json({
      success: true,
      data: {
        id: waitlistEntry.id,
        position: waitlistEntry.position,
        status: waitlistEntry.status,
        joined_at: waitlistEntry.joined_at,
        notified_at: waitlistEntry.notified_at,
        expires_at: waitlistEntry.expires_at,
        total_waitlist: waitlistEntry.Event?.waitlist_count || 0,
        event_title: waitlistEntry.Event?.title
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all waitlist entries for an event (Admin/Staff)
exports.getEventWaitlist = async (req, res) => {
  try {
    const { eventId } = req.params;

    const waitlistEntries = await EventWaitlist.findAll({
      where: {
        event_id: eventId,
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'student_number']
      }],
      order: [['position', 'ASC']]
    });

    res.json({ success: true, data: waitlistEntries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get user's all waitlisted events
exports.getMyWaitlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const waitlistEntries = await EventWaitlist.findAll({
      where: {
        user_id: userId,
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      include: [{
        model: Event,
        attributes: ['id', 'title', 'description', 'category', 'date', 'start_time', 'end_time',
          'location', 'capacity', 'registered_count', 'waitlist_count', 'status']
      }],
      order: [['joined_at', 'DESC']]
    });

    res.json({ success: true, data: waitlistEntries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Accept waitlist spot (when notified)
exports.acceptWaitlistSpot = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const waitlistEntry = await EventWaitlist.findOne({
      where: {
        event_id: eventId,
        user_id: userId,
        status: 'notified'
      },
      include: [{ model: Event }]
    });

    if (!waitlistEntry) {
      throw new Error('No notified waitlist entry found');
    }

    // Check if expiration time has passed
    if (waitlistEntry.expires_at && new Date() > new Date(waitlistEntry.expires_at)) {
      await waitlistEntry.update({ status: 'expired' }, { transaction: t });
      await t.commit();
      throw new Error('Your acceptance window has expired');
    }

    const event = waitlistEntry.Event;

    // Double-check if there's still room
    if (event.registered_count >= event.capacity) {
      throw new Error('Event is full. Another person was faster.');
    }

    // Create registration
    const qrToken = qrCodeService.generateToken('event');
    const qrData = { u: userId, e: eventId, r: qrToken, type: 'event' };
    const qrCode = await qrCodeService.generateQRCode(qrData);

    const registration = await EventRegistration.create({
      event_id: eventId,
      user_id: userId,
      qr_code: qrToken,
      custom_fields_json: {}
    }, { transaction: t });

    // Update event counts
    await event.increment('registered_count', { transaction: t });
    await event.decrement('waitlist_count', { transaction: t });

    // Update waitlist entry status
    await waitlistEntry.update({ status: 'promoted' }, { transaction: t });

    // Reorder remaining waitlist
    await EventWaitlist.decrement('position', {
      by: 1,
      where: {
        event_id: eventId,
        position: { [Op.gt]: waitlistEntry.position },
        status: { [Op.in]: ['waiting', 'notified'] }
      },
      transaction: t
    });

    await t.commit();

    // Send confirmation email
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendEventRegistrationConfirmation(user, event, qrCode);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    res.json({
      success: true,
      message: 'Successfully registered for the event!',
      data: {
        ...registration.toJSON(),
        qrCode
      }
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// Helper function: Promote next person in waitlist when a spot opens
// This should be called when someone cancels their registration
exports.promoteNextInWaitlist = async (eventId, transaction) => {
  try {
    const event = await Event.findByPk(eventId);
    if (!event || event.registered_count >= event.capacity) {
      return null; // No spot available
    }

    // Find the first person in the waitlist
    const nextInLine = await EventWaitlist.findOne({
      where: {
        event_id: eventId,
        status: 'waiting'
      },
      order: [['position', 'ASC']],
      include: [{ model: User }],
      transaction
    });

    if (!nextInLine) {
      return null; // No one in waitlist
    }

    // Set expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Update waitlist entry to 'notified'
    await nextInLine.update({
      status: 'notified',
      notified_at: new Date(),
      expires_at: expiresAt
    }, { transaction });

    // Send notification email
    try {
      if (nextInLine.User) {
        await notificationService.sendWaitlistSpotAvailable(nextInLine.User, event, expiresAt);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    return nextInLine;
  } catch (error) {
    console.error('Error promoting waitlist:', error);
    return null;
  }
};