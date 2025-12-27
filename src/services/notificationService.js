const sendEmail = require('../utils/emailService');

/**
 * Notification Service
 * Email, in-app notification ve push notification yönetimi
 * 
 * Bu servis hem email hem de veritabanına in-app bildirim kaydeder.
 * Kullanıcı tercihlerine göre bildirim kanalları belirlenir.
 */

// Lazy loading for db to avoid circular dependency
let db = null;
const getDb = () => {
  if (!db) {
    db = require('../models');
  }
  return db;
};

/**
 * In-app bildirim oluştur
 * @param {Object} options - Bildirim seçenekleri
 * @param {string} options.userId - Kullanıcı ID
 * @param {string} options.title - Bildirim başlığı
 * @param {string} options.message - Bildirim mesajı
 * @param {string} options.category - Kategori (academic, attendance, meal, event, payment, system)
 * @param {string} options.type - Tip (info, success, warning, error)
 * @param {string} options.link - Yönlendirme linki
 * @param {Object} options.metadata - Ek veriler
 */
const createInAppNotification = async ({ userId, title, message, category = 'system', type = 'info', link = null, metadata = {} }) => {
  try {
    const database = getDb();
    if (!database.Notification) {
      console.warn('Notification modeli bulunamadı, in-app bildirim atlanıyor.');
      return null;
    }

    // Kullanıcı tercihlerini kontrol et
    const preferences = await database.NotificationPreference?.findOne({
      where: { user_id: userId }
    });

    // Push/in-app tercihi kapalıysa bildirim oluşturma
    const pushField = `push_${category}`;
    if (preferences && preferences[pushField] === false) {
      console.log(`Kullanıcı ${userId} için ${category} kategorisi in-app bildirimleri kapalı.`);
      return null;
    }

    const notification = await database.Notification.create({
      user_id: userId,
      title,
      message,
      category,
      type,
      link,
      metadata
    });

    return notification;
  } catch (error) {
    console.error('In-app bildirim oluşturma hatası:', error);
    return null;
  }
};

/**
 * Email gönder (tercihlere göre)
 */
const sendEmailWithPreferences = async (userId, email, subject, message, category) => {
  try {
    const database = getDb();

    // Kullanıcı tercihlerini kontrol et
    const preferences = await database.NotificationPreference?.findOne({
      where: { user_id: userId }
    });

    const emailField = `email_${category}`;
    if (preferences && preferences[emailField] === false) {
      console.log(`Kullanıcı ${userId} için ${category} kategorisi email bildirimleri kapalı.`);
      return;
    }

    await sendEmail({ email, subject, message });
  } catch (error) {
    console.error('Email gönderim hatası:', error);
  }
};

/**
 * Yemek rezervasyon onay bildirimi
 */
exports.sendReservationConfirmation = async (user, reservation, menu) => {
  const title = 'Yemek Rezervasyonu Onaylandı';
  const message = `${reservation.reservation_date} tarihli ${reservation.meal_type === 'lunch' ? 'öğle' : 'akşam'} yemeği rezervasyonunuz onaylandı.`;

  // In-app bildirim
  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'meal',
    type: 'success',
    link: '/meals/reservations'
  });

  // Email bildirimi
  const emailMessage = `
Merhaba ${user.name || user.email},

Yemek rezervasyonunuz başarıyla oluşturuldu.

Detaylar:
- Tarih: ${reservation.reservation_date}
- Öğün: ${reservation.meal_type === 'lunch' ? 'Öğle Yemeği' : 'Akşam Yemeği'}
- Menü: ${menu?.items_json ? JSON.stringify(menu.items_json) : 'Standart Menü'}
- QR Kod: Rezervasyonlarım sayfasından QR kodunuzu görebilirsiniz.

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, 'Yemek Rezervasyonu Onayı', emailMessage, 'meal');
};

/**
 * Yemek rezervasyon iptal bildirimi
 */
exports.sendReservationCancellation = async (user, reservation) => {
  const title = 'Yemek Rezervasyonu İptal Edildi';
  const message = `${reservation.reservation_date} tarihli yemek rezervasyonunuz iptal edildi.${reservation.amount > 0 ? ` İade: ${reservation.amount} TRY` : ''}`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'meal',
    type: 'warning',
    link: '/meals/reservations'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

Yemek rezervasyonunuz iptal edildi.

Detaylar:
- Tarih: ${reservation.reservation_date}
- Öğün: ${reservation.meal_type === 'lunch' ? 'Öğle Yemeği' : 'Akşam Yemeği'}
${reservation.amount > 0 ? `İade tutarı: ${reservation.amount} TRY (Cüzdanınıza yüklendi)` : ''}

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, 'Yemek Rezervasyonu İptali', emailMessage, 'meal');
};

/**
 * Etkinlik kayıt onay bildirimi
 */
exports.sendEventRegistrationConfirmation = async (user, event, qrCode) => {
  const title = `Etkinlik Kaydı: ${event.title}`;
  const message = `${event.title} etkinliğine başarıyla kayıt oldunuz. Tarih: ${event.date}`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'event',
    type: 'success',
    link: '/my-events'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

${event.title} etkinliğine başarıyla kayıt oldunuz.

Etkinlik Detayları:
- Tarih: ${event.date}
- Saat: ${event.start_time} - ${event.end_time}
- Konum: ${event.location}
${event.is_paid ? `- Ücret: ${event.price} TRY` : ''}

QR kodunuzu etkinlik girişinde göstermeniz gerekmektedir.
QR kodunuzu "Etkinliklerim" sayfasından görebilirsiniz.

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, `Etkinlik Kaydı: ${event.title}`, emailMessage, 'event');
};

/**
 * Etkinlik kayıt iptal bildirimi
 */
exports.sendEventCancellation = async (user, event) => {
  const title = `Etkinlik Kaydı İptal: ${event.title}`;
  const message = `${event.title} etkinliğine olan kaydınız iptal edildi.`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'event',
    type: 'warning',
    link: '/events'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

${event.title} etkinliğine olan kaydınız iptal edildi.

Etkinlik Detayları:
- Tarih: ${event.date}
- Saat: ${event.start_time} - ${event.end_time}

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, `Etkinlik Kayıt İptali: ${event.title}`, emailMessage, 'event');
};

/**
 * Ödeme onay bildirimi
 */
exports.sendPaymentConfirmation = async (user, amount, transactionType) => {
  const title = transactionType === 'deposit' ? 'Bakiye Yüklendi' : 'Ödeme Tamamlandı';
  const message = `${amount} TRY ${transactionType === 'deposit' ? 'cüzdanınıza yüklendi' : 'ödemeniz tamamlandı'}.`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'payment',
    type: 'success',
    link: '/wallet'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

${transactionType === 'deposit' ? 'Cüzdanınıza para yüklendi.' : 'Ödemeniz tamamlandı.'}

Detaylar:
- Tutar: ${amount} TRY
- İşlem Tipi: ${transactionType === 'deposit' ? 'Bakiye Yükleme' : 'Ödeme'}
- Tarih: ${new Date().toLocaleString('tr-TR')}

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, title, emailMessage, 'payment');
};

/**
 * Derslik rezervasyon durumu bildirimi
 */
exports.sendClassroomReservationStatus = async (user, reservation, status) => {
  const title = `Derslik Rezervasyon ${status === 'approved' ? 'Onaylandı' : 'Reddedildi'}`;
  const message = `Derslik rezervasyon talebiniz ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'academic',
    type: status === 'approved' ? 'success' : 'error',
    link: '/reservations'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

Derslik rezervasyon talebiniz ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.

Detaylar:
- Derslik: ${reservation.classroom_id}
- Tarih: ${reservation.date}
- Saat: ${reservation.start_time} - ${reservation.end_time}
- Amaç: ${reservation.purpose}
- Durum: ${status === 'approved' ? 'Onaylandı' : 'Reddedildi'}

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, title, emailMessage, 'academic');
};

/**
 * Yoklama bildirimi (öğrenci için)
 */
exports.sendAttendanceNotification = async (user, session, status) => {
  const title = status === 'success' ? 'Yoklama Alındı' : 'Yoklama Uyarısı';
  const message = status === 'success'
    ? 'Yoklamanız başarıyla kaydedildi.'
    : 'Yoklamanız şüpheli olarak işaretlendi.';

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'attendance',
    type: status === 'success' ? 'success' : 'warning',
    link: '/attendance/my-history'
  });
};

/**
 * Devamsızlık uyarısı
 */
exports.sendAbsenceWarning = async (user, courseName, absenceRate) => {
  const isWarning = absenceRate >= 20 && absenceRate < 30;
  const isCritical = absenceRate >= 30;

  const title = isCritical ? 'KRİTİK: Devamsızlık Sınırı' : 'Devamsızlık Uyarısı';
  const message = `${courseName} dersinde devamsızlık oranınız %${absenceRate.toFixed(1)}'e ulaştı.${isCritical ? ' Dersten kalabilirsiniz!' : ''}`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'attendance',
    type: isCritical ? 'error' : 'warning',
    link: '/attendance/my-history'
  });

  if (isCritical) {
    const emailMessage = `
Merhaba ${user.name || user.email},

ÖNEMLİ UYARI: ${courseName} dersinde devamsızlık oranınız kritik seviyeye (%${absenceRate.toFixed(1)}) ulaştı!

%30 devamsızlık sınırını aştığınızda dersten kalırsınız.

Lütfen devamsızlık durumunuzu kontrol edin ve gerekli önlemleri alın.

İyi günler!
    `;

    await sendEmailWithPreferences(user.id, user.email, 'KRİTİK: Devamsızlık Uyarısı', emailMessage, 'attendance');
  }
};

/**
 * Not bildirimi
 */
exports.sendGradeNotification = async (user, courseName, gradeType, grade) => {
  const title = `Not Girişi: ${courseName}`;
  const message = `${courseName} dersi ${gradeType} notunuz: ${grade}`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'academic',
    type: 'info',
    link: '/grades/my-grades'
  });

  const emailMessage = `
Merhaba ${user.name || user.email},

${courseName} dersi için ${gradeType} notunuz girildi.

Not: ${grade}

Detaylı bilgi için "Notlarım" sayfasını ziyaret edebilirsiniz.

İyi günler!
  `;

  await sendEmailWithPreferences(user.id, user.email, title, emailMessage, 'academic');
};

/**
 * Derse kayıt bildirimi
 */
exports.sendEnrollmentNotification = async (user, courseName, sectionNumber) => {
  const title = 'Derse Kayıt Başarılı';
  const message = `${courseName} - Şube ${sectionNumber} dersine başarıyla kayıt oldunuz.`;

  await createInAppNotification({
    userId: user.id,
    title,
    message,
    category: 'academic',
    type: 'success',
    link: '/my-courses'
  });
};

/**
 * Sistem bildirimi
 */
exports.sendSystemNotification = async (userId, title, message, link = null) => {
  await createInAppNotification({
    userId,
    title,
    message,
    category: 'system',
    type: 'info',
    link
  });
};

// Export helper functions
exports.createInAppNotification = createInAppNotification;
