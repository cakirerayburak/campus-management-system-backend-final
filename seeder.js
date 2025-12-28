const fs = require('fs');
const colors = require('colors');
const dotenv = require('dotenv');
const db = require('./src/models');

// Çevre değişkenlerini yükle
dotenv.config({ path: './src/config/config.env' });

// Veritabanı Modelleri
const User = db.User;
const Student = db.Student;
const Faculty = db.Faculty;
const Department = db.Department;
const Course = db.Course;
const CourseSection = db.CourseSection;
const Classroom = db.Classroom;
const Enrollment = db.Enrollment;
const Announcement = db.Announcement;

// --- PART 3 MODELLERİ ---
const Wallet = db.Wallet;
const Cafeteria = db.Cafeteria;
const MealMenu = db.MealMenu;
const Event = db.Event;
const EventRegistration = db.EventRegistration;
const EventWaitlist = db.EventWaitlist;
const Schedule = db.Schedule;

// --- PART 4 MODELLERİ ---
const Notification = db.Notification;
const NotificationPreference = db.NotificationPreference;
const AuditLog = db.AuditLog;


// SEED FONKSİYONU
const seedData = async () => {
  try {
    // 1. VERİTABANINI SIFIRLA
    await db.sequelize.sync({ force: true });
    console.log('Veritabanı sıfırlandı ve tablolar yeniden oluşturuldu...'.cyan.bold);

    // -----------------------------------------------------------------------
    // 2. BÖLÜMLER (DEPARTMENTS)
    // -----------------------------------------------------------------------
    const deptComputer = await Department.create({
      name: 'Bilgisayar Mühendisliği',
      code: 'CENG',
      faculty_name: 'Mühendislik Fakültesi'
    });

    const deptElectrical = await Department.create({
      name: 'Elektrik-Elektronik Müh.',
      code: 'EEE',
      faculty_name: 'Mühendislik Fakültesi'
    });

    const deptArchitecture = await Department.create({
      name: 'Mimarlık',
      code: 'ARCH',
      faculty_name: 'Mimarlık ve Tasarım Fakültesi'
    });

    console.log('Bölümler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 3. DERSLİKLER (CLASSROOMS)
    // -----------------------------------------------------------------------
    const room101 = await Classroom.create({
      code: 'MB-101', // Kod eklendi
      building: 'Mühendislik A Blok',
      room_number: '101',
      capacity: 60,
      type: 'classroom',
      latitude: 41.0255,
      longitude: 40.5201
    });

    const labComp = await Classroom.create({
      code: 'MB-LAB1',
      building: 'Mühendislik B Blok',
      room_number: 'LAB-1',
      capacity: 30,
      type: 'lab',
      latitude: 41.0258,
      longitude: 40.5205
    });

    const roomArch = await Classroom.create({
      code: 'MF-Z10',
      building: 'Mimarlık Fakültesi',
      room_number: 'Z-10',
      capacity: 45,
      type: 'studio',
      latitude: 41.0260,
      longitude: 40.5210
    });
    console.log('Derslikler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 4. KULLANICILAR (ADMIN, HOCA, ÖĞRENCİ)
    // -----------------------------------------------------------------------

    // --- Admin ---
    await User.create({
      name: 'Sistem Yöneticisi',
      email: 'admin@smartcampus.com',
      password_hash: 'Password123',
      role: 'admin',
      is_verified: true
    });

    // --- Hocalar ---
    const userFac1 = await User.create({
      name: 'Dr. Ahmet Yılmaz',
      email: 'ahmet@smartcampus.com',
      password_hash: 'Password123',
      role: 'faculty',
      is_verified: true
    });
    const faculty1 = await Faculty.create({
      userId: userFac1.id,
      departmentId: deptComputer.id,
      title: 'Dr. Öğr. Üyesi',
      office_number: 'A-204',
      employee_number: 'FAC-001'
    });

    const userFac2 = await User.create({
      name: 'Prof. Dr. Zeynep Kaya',
      email: 'zeynep@smartcampus.com',
      password_hash: 'Password123',
      role: 'faculty',
      is_verified: true
    });
    const faculty2 = await Faculty.create({
      userId: userFac2.id,
      departmentId: deptArchitecture.id,
      title: 'Prof. Dr.',
      office_number: 'M-101',
      employee_number: 'FAC-002'
    });

    // --- Öğrenciler ---
    const userStu1 = await User.create({
      name: 'Ali Demir',
      email: 'ali@smartcampus.com',
      password_hash: 'Password123',
      role: 'student',
      is_verified: true
    });
    const student1 = await Student.create({
      userId: userStu1.id,
      departmentId: deptComputer.id,
      student_number: '2021001',
      gpa: 3.50,
      cgpa: 3.50,
      semester_gpa: 3.75,
      total_credits_earned: 45,
      total_ects_earned: 75,
      current_semester: 3
    });

    const userStu2 = await User.create({
      name: 'Ayşe Çelik',
      email: 'ayse@smartcampus.com',
      password_hash: 'Password123',
      role: 'student',
      is_verified: true
    });
    const student2 = await Student.create({
      userId: userStu2.id,
      departmentId: deptComputer.id,
      student_number: '2021002',
      gpa: 2.80,
      cgpa: 2.80,
      semester_gpa: 3.00,
      total_credits_earned: 42,
      total_ects_earned: 70,
      current_semester: 3,
      is_scholarship: true // Ayşe burslu olsun (Yemekhane testi için)
    });

    console.log('Kullanıcılar eklendi...'.green);


    // -----------------------------------------------------------------------
    // 5. DERSLER (COURSES) - 2 Yıllık Müfredat
    // -----------------------------------------------------------------------

    // === 1. YIL - 1. DÖNEM (Fall 2023) ===
    const courseCalc1 = await Course.create({
      code: 'MATH101',
      name: 'Calculus I (Matematik I)',
      description: 'Limit, türev ve integral kavramları.',
      credits: 4,
      ects: 6,
      departmentId: deptComputer.id
    });

    const coursePhysics1 = await Course.create({
      code: 'PHYS101',
      name: 'Physics I (Fizik I)',
      description: 'Mekanik ve termodinamik.',
      credits: 4,
      ects: 6,
      departmentId: deptComputer.id
    });

    const courseAlgo = await Course.create({
      code: 'CENG101',
      name: 'Algoritma ve Programlamaya Giriş',
      description: 'Temel C++ eğitimi.',
      credits: 4,
      ects: 6,
      departmentId: deptComputer.id
    });

    // === 1. YIL - 2. DÖNEM (Spring 2024) ===
    const courseCalc2 = await Course.create({
      code: 'MATH102',
      name: 'Calculus II (Matematik II)',
      description: 'İleri integral ve diferansiyel denklemler.',
      credits: 4,
      ects: 6,
      departmentId: deptComputer.id,
      prerequisiteId: courseCalc1.id
    });

    const courseData = await Course.create({
      code: 'CENG102',
      name: 'Veri Yapıları',
      description: 'Linked List, Tree, Graph yapıları.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseAlgo.id
    });

    const courseOOP = await Course.create({
      code: 'CENG103',
      name: 'Nesne Yönelimli Programlama',
      description: 'Java ile OOP prensipleri.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseAlgo.id
    });

    // === 2. YIL - 1. DÖNEM (Fall 2024) ===
    const courseDB = await Course.create({
      code: 'CENG201',
      name: 'Veritabanı Sistemleri',
      description: 'SQL, ER diyagramları, normalizasyon.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseData.id
    });

    const courseOS = await Course.create({
      code: 'CENG202',
      name: 'İşletim Sistemleri',
      description: 'Process, thread, memory management.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseData.id
    });

    const courseNetwork = await Course.create({
      code: 'CENG203',
      name: 'Bilgisayar Ağları',
      description: 'TCP/IP, OSI modeli, network protocols.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id
    });

    // === 2. YIL - 2. DÖNEM (Spring 2025 - Aktif Dönem) ===
    const courseSE = await Course.create({
      code: 'CENG204',
      name: 'Yazılım Mühendisliği',
      description: 'Agile, Scrum, software design patterns.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseOOP.id
    });

    const courseWeb = await Course.create({
      code: 'CENG205',
      name: 'Web Programlama',
      description: 'HTML, CSS, JavaScript, React, Node.js.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseOOP.id
    });

    // Mimarlık dersi (Başka bölüm için)
    const courseArch = await Course.create({
      code: 'ARCH101',
      name: 'Mimari Tasarıma Giriş',
      description: 'Temel çizim teknikleri.',
      credits: 4,
      ects: 7,
      departmentId: deptArchitecture.id
    });

    console.log('Dersler eklendi (2 yıllık müfredat)...'.green);

    // -----------------------------------------------------------------------
    // 6. ŞUBELER (SECTIONS) VE ÇİZELGE (SCHEDULE) - 4 Dönemlik
    // -----------------------------------------------------------------------

    // === 1. YIL - 1. DÖNEM (Fall 2023) - GEÇMİŞ ===
    const sectionCalc1 = await CourseSection.create({
      courseId: courseCalc1.id,
      section_number: 1,
      semester: 'Fall',
      year: 2023,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Monday', start: '09:00', room: 'MB-101' }
    });

    const sectionPhysics1 = await CourseSection.create({
      courseId: coursePhysics1.id,
      section_number: 1,
      semester: 'Fall',
      year: 2023,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Tuesday', start: '13:00', room: 'MB-101' }
    });

    const sectionAlgoFall23 = await CourseSection.create({
      courseId: courseAlgo.id,
      section_number: 1,
      semester: 'Fall',
      year: 2023,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 2,
      schedule_json: { day: 'Wednesday', start: '09:00', room: 'MB-LAB1' }
    });

    // === 1. YIL - 2. DÖNEM (Spring 2024) - GEÇMİŞ ===
    const sectionCalc2 = await CourseSection.create({
      courseId: courseCalc2.id,
      section_number: 1,
      semester: 'Spring',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Monday', start: '09:00', room: 'MB-101' }
    });

    const sectionData24 = await CourseSection.create({
      courseId: courseData.id,
      section_number: 1,
      semester: 'Spring',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 2,
      schedule_json: { day: 'Tuesday', start: '09:00', room: 'MB-LAB1' }
    });

    const sectionOOP24 = await CourseSection.create({
      courseId: courseOOP.id,
      section_number: 1,
      semester: 'Spring',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 2,
      schedule_json: { day: 'Thursday', start: '13:00', room: 'MB-LAB1' }
    });

    // === 2. YIL - 1. DÖNEM (Fall 2024) - GEÇMİŞ ===
    const sectionDB24 = await CourseSection.create({
      courseId: courseDB.id,
      section_number: 1,
      semester: 'Fall',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 2,
      schedule_json: { day: 'Monday', start: '09:00', room: 'MB-LAB1' }
    });

    const sectionOS24 = await CourseSection.create({
      courseId: courseOS.id,
      section_number: 1,
      semester: 'Fall',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Wednesday', start: '13:00', room: 'MB-101' }
    });

    const sectionNetwork24 = await CourseSection.create({
      courseId: courseNetwork.id,
      section_number: 1,
      semester: 'Fall',
      year: 2024,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Friday', start: '09:00', room: 'MB-101' }
    });

    // === 2. YIL - 2. DÖNEM (Spring 2025) - AKTİF DÖNEM ===
    const sectionSE25 = await CourseSection.create({
      courseId: courseSE.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 2,
      schedule_json: { day: 'Monday', start: '09:00', room: 'MB-101' }
    });

    await Schedule.create({
      section_id: sectionSE25.id,
      classroom_id: room101.id,
      day_of_week: 'Monday',
      start_time: '09:00',
      end_time: '12:00'
    });

    const sectionWeb25 = await CourseSection.create({
      courseId: courseWeb.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 2,
      schedule_json: { day: 'Wednesday', start: '13:00', room: 'MB-LAB1' }
    });

    await Schedule.create({
      section_id: sectionWeb25.id,
      classroom_id: labComp.id,
      day_of_week: 'Wednesday',
      start_time: '13:00',
      end_time: '16:00'
    });

    // ARCH101 (Aktif)
    const sectionArch = await CourseSection.create({
      courseId: courseArch.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty2.id,
      classroomId: roomArch.id,
      capacity: 45,
      enrolled_count: 0,
      schedule_json: { day: 'Tuesday', start: '09:00', room: 'MF-Z10' }
    });

    await Schedule.create({
      section_id: sectionArch.id,
      classroom_id: roomArch.id,
      day_of_week: 'Tuesday',
      start_time: '09:00',
      end_time: '13:00'
    });

    console.log('Şubeler eklendi (4 dönemlik)...'.green);


    // -----------------------------------------------------------------------
    // 7. DUYURULAR
    // -----------------------------------------------------------------------

    await Announcement.create({
      title: '2025 Bahar Dönemi Başlıyor',
      content: 'Tüm öğrencilerimize yeni dönemde başarılar dileriz. Ders kayıtları açılmıştır.',
      target_role: 'all',
      priority: 'high'
    });

    // -----------------------------------------------------------------------
    // 8. CÜZDANLAR (WALLETS) - PART 3
    // -----------------------------------------------------------------------
    // Ali'ye 500 TL, Ayşe'ye 150 TL bakiye verelim
    await Wallet.create({ user_id: userStu1.id, balance: 500.00 });
    await Wallet.create({ user_id: userStu2.id, balance: 150.00 });
    // Hocalara da cüzdan açalım (Yemek yiyebilmeleri için)
    await Wallet.create({ user_id: userFac1.id, balance: 1000.00 });

    console.log('Cüzdanlar oluşturuldu...'.green);

    // -----------------------------------------------------------------------
    // 9. YEMEKHANE VE MENÜLER - PART 3
    // -----------------------------------------------------------------------
    const mainCafeteria = await Cafeteria.create({
      name: 'Merkez Yemekhane',
      location: 'Kampüs Orta Alan',
      capacity: 1000
    });

    const engCafeteria = await Cafeteria.create({
      name: 'Mühendislik Kantini',
      location: 'Mühendislik Binası',
      capacity: 200
    });

    // Dinamik tarih (Bugün ve Yarın)
    const today = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    // Bugünün Menüsü
    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: today,
      meal_type: 'lunch',
      items_json: ['Mercimek Çorbası', 'Orman Kebabı', 'Pirinç Pilavı', 'Cacık'],
      nutrition_json: { calories: 850, protein: 25 },
      price: 20.00
    });

    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: today,
      meal_type: 'dinner',
      items_json: ['Domates Çorbası', 'Tavuk Sote', 'Bulgur Pilavı', 'Tatlı'],
      nutrition_json: { calories: 780, protein: 30 },
      price: 20.00
    });

    // Yarının Menüsü
    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: tomorrow,
      meal_type: 'lunch',
      items_json: ['Ezogelin Çorbası', 'Kuru Fasulye', 'Pilav', 'Turşu'],
      nutrition_json: { calories: 900, protein: 20 },
      price: 20.00
    });

    console.log('Yemekhane ve menüler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 10. ETKİNLİKLER VE WAITLIST - PART 3 + WAITLIST
    // -----------------------------------------------------------------------

    // Gelecek bir tarih
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 10); // 10 gün sonra
    const eventDateStr = eventDate.toISOString().split('T')[0];

    const event1 = await Event.create({
      title: 'Bahar Teknoloji Şenliği',
      description: 'Mühendislik fakültesi bahçesinde teknoloji stantları ve konserler.',
      category: 'Social',
      date: eventDateStr,
      start_time: '10:00',
      end_time: '18:00',
      location: 'Mühendislik Bahçesi',
      capacity: 500,
      registered_count: 0,
      waitlist_count: 0
    });

    const event2 = await Event.create({
      title: 'Kariyer Zirvesi 2025',
      description: 'Sektörün önde gelen firmaları ile tanışma fırsatı.',
      category: 'Career',
      date: eventDateStr,
      start_time: '13:00',
      end_time: '17:00',
      location: 'Konferans Salonu A',
      capacity: 200,
      registered_count: 0,
      waitlist_count: 0
    });

    // ÖNEMLİ: Waitlist testi için sınırlı kapasiteli etkinlik
    const limitedEvent = await Event.create({
      title: 'Yapay Zeka Workshop',
      description: 'Sınırlı kontenjan! ChatGPT ve modern AI araçlarını öğrenin.',
      category: 'workshop',
      date: eventDateStr,
      start_time: '14:00',
      end_time: '17:00',
      location: 'B-Blok Lab 3',
      capacity: 3, // Sadece 3 kişilik (waitlist test için)
      registered_count: 3, // Dolu!
      waitlist_count: 2 // 2 kişi bekliyor
    });

    console.log('Etkinlikler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 10.1 ETKİNLİK KAYITLARI (EVENT REGISTRATIONS)
    // -----------------------------------------------------------------------
    if (EventRegistration) {
      // Ali event1'e kayıtlı
      await EventRegistration.create({
        event_id: event1.id,
        user_id: userStu1.id,
        qr_code: 'EVT-ALI-' + Date.now(),
        checked_in: false
      });
      await event1.increment('registered_count');

      // Ayşe event1'e kayıtlı
      await EventRegistration.create({
        event_id: event1.id,
        user_id: userStu2.id,
        qr_code: 'EVT-AYSE-' + Date.now(),
        checked_in: false
      });
      await event1.increment('registered_count');

      // Hoca event2'ye kayıtlı
      await EventRegistration.create({
        event_id: event2.id,
        user_id: userFac1.id,
        qr_code: 'EVT-FAC1-' + Date.now(),
        checked_in: false
      });
      await event2.increment('registered_count');

      console.log('Etkinlik kayıtları eklendi...'.green);
    }

    // -----------------------------------------------------------------------
    // 10.2 WAITLIST KAYITLARI (BEKLEME LİSTESİ)
    // -----------------------------------------------------------------------
    if (EventWaitlist) {
      // Ali sınırlı etkinlik için bekleme listesinde (1. sırada)
      await EventWaitlist.create({
        event_id: limitedEvent.id,
        user_id: userStu1.id,
        position: 1,
        status: 'waiting',
        joined_at: new Date()
      });

      // Ayşe sınırlı etkinlik için bekleme listesinde (2. sırada, bildirilmiş - yer açılmış!)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 20); // 20 saat kaldı
      await EventWaitlist.create({
        event_id: limitedEvent.id,
        user_id: userStu2.id,
        position: 2,
        status: 'notified', // Bir yer açıldı, ona bildirildi!
        notified_at: new Date(),
        expires_at: expiresAt,
        joined_at: new Date(Date.now() - 86400000) // 1 gün önce katıldı
      });

      console.log('Waitlist (bekleme listesi) kayıtları eklendi...'.green);
    }


    // -----------------------------------------------------------------------
    // 11. 2. SINIF ÖĞRENCİ SİMÜLASYONU - KAPSAMLI AKADEMİK GEÇMİŞ
    // -----------------------------------------------------------------------
    console.log('2. sınıf öğrenci simülasyonu başlıyor...'.cyan);

    // === ALİ'NİN AKADEMİK GEÇMİŞİ (4 Dönem) ===

    // --- 1. Dönem (Fall 2023) - GEÇMİŞ ---
    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionCalc1.id,
      status: 'passed',
      midterm_grade: 75,
      final_grade: 82,
      letter_grade: 'BB',
      grade_point: 3.0
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionPhysics1.id,
      status: 'passed',
      midterm_grade: 85,
      final_grade: 88,
      letter_grade: 'BA',
      grade_point: 3.5
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionAlgoFall23.id,
      status: 'passed',
      midterm_grade: 90,
      final_grade: 95,
      letter_grade: 'AA',
      grade_point: 4.0
    });
    console.log('  ✓ 1. Dönem (Fall 2023): 3 ders geçildi'.green);

    // --- 2. Dönem (Spring 2024) - GEÇMİŞ ---
    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionCalc2.id,
      status: 'passed',
      midterm_grade: 70,
      final_grade: 78,
      letter_grade: 'CB',
      grade_point: 2.5
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionData24.id,
      status: 'passed',
      midterm_grade: 88,
      final_grade: 92,
      letter_grade: 'AA',
      grade_point: 4.0
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionOOP24.id,
      status: 'passed',
      midterm_grade: 82,
      final_grade: 85,
      letter_grade: 'BA',
      grade_point: 3.5
    });
    console.log('  ✓ 2. Dönem (Spring 2024): 3 ders geçildi'.green);

    // --- 3. Dönem (Fall 2024) - GEÇMİŞ ---
    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionDB24.id,
      status: 'passed',
      midterm_grade: 92,
      final_grade: 94,
      letter_grade: 'AA',
      grade_point: 4.0
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionOS24.id,
      status: 'passed',
      midterm_grade: 78,
      final_grade: 80,
      letter_grade: 'BB',
      grade_point: 3.0
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionNetwork24.id,
      status: 'passed',
      midterm_grade: 85,
      final_grade: 90,
      letter_grade: 'AA',
      grade_point: 4.0
    });
    console.log('  ✓ 3. Dönem (Fall 2024): 3 ders geçildi'.green);

    // --- 4. Dönem (Spring 2025) - AKTİF DÖNEM ---
    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionSE25.id,
      status: 'enrolled',
      midterm_grade: 88, // Vize notu girilmiş
      final_grade: null  // Final henüz yok
    });

    await Enrollment.create({
      studentId: student1.id,
      sectionId: sectionWeb25.id,
      status: 'enrolled',
      midterm_grade: 92, // Vize notu girilmiş
      final_grade: null
    });
    console.log('  ✓ 4. Dönem (Spring 2025): 2 aktif ders'.yellow);

    // === AYŞE'NİN AKADEMİK GEÇMİŞİ (Daha düşük notlar) ===
    await Enrollment.create({
      studentId: student2.id,
      sectionId: sectionCalc1.id,
      status: 'passed',
      midterm_grade: 60,
      final_grade: 65,
      letter_grade: 'DC',
      grade_point: 1.5
    });

    await Enrollment.create({
      studentId: student2.id,
      sectionId: sectionAlgoFall23.id,
      status: 'passed',
      midterm_grade: 70,
      final_grade: 75,
      letter_grade: 'CB',
      grade_point: 2.5
    });

    await Enrollment.create({
      studentId: student2.id,
      sectionId: sectionSE25.id,
      status: 'enrolled',
      midterm_grade: 75,
      final_grade: null
    });
    console.log('  ✓ Ayşe: 2 geçmiş ders + 1 aktif ders'.green);

    // === YOKLAMA KAYITLARI (AttendanceSession + AttendanceRecord) ===
    const AttendanceSession = db.AttendanceSession;
    const AttendanceRecord = db.AttendanceRecord;

    if (AttendanceSession && AttendanceRecord) {
      // 3 gün önceki tarih
      const threeDaysAgo = new Date(Date.now() - 86400000 * 3);
      const yesterday = new Date(Date.now() - 86400000);

      // Yazılım Mühendisliği için yoklama oturumu
      const session1 = await AttendanceSession.create({
        sectionId: sectionSE25.id,
        instructorId: faculty1.id,
        date: threeDaysAgo.toISOString().split('T')[0], // YYYY-MM-DD
        start_time: '09:00:00',
        end_time: '12:00:00',
        latitude: 41.0255,
        longitude: 40.5201,
        geofence_radius: 50,
        qr_code: 'SE25-' + Date.now(),
        status: 'closed'
      });

      await AttendanceRecord.create({
        sessionId: session1.id,
        studentId: student1.id,
        check_in_time: new Date(threeDaysAgo.getTime() + 600000), // 10 dk sonra
        latitude: 41.0256,
        longitude: 40.5202,
        distance_from_center: 15,
        is_suspicious: false
      });

      await AttendanceRecord.create({
        sessionId: session1.id,
        studentId: student2.id,
        check_in_time: new Date(threeDaysAgo.getTime() + 1200000), // 20 dk sonra
        latitude: 41.0257,
        longitude: 40.5203,
        distance_from_center: 25,
        is_suspicious: false
      });

      // Web Programlama için yoklama oturumu
      const session2 = await AttendanceSession.create({
        sectionId: sectionWeb25.id,
        instructorId: faculty1.id,
        date: yesterday.toISOString().split('T')[0],
        start_time: '13:00:00',
        end_time: '16:00:00',
        latitude: 41.0258,
        longitude: 40.5205,
        geofence_radius: 50,
        qr_code: 'WEB25-' + Date.now(),
        status: 'closed'
      });

      await AttendanceRecord.create({
        sessionId: session2.id,
        studentId: student1.id,
        check_in_time: new Date(yesterday.getTime() + 300000),
        latitude: 41.0258,
        longitude: 40.5206,
        distance_from_center: 10,
        is_suspicious: false
      });

      console.log('  ✓ Yoklama kayıtları eklendi'.green);
    }


    // === ÖĞRENCİ İSTATİSTİKLERİNİ GÜNCELLE ===
    // Ali: 9 ders geçti (toplam 29 kredi, 47 AKTS) + 2 aktif
    await Student.update({
      gpa: 3.50,
      cgpa: 3.50,
      semester_gpa: 0, // Aktif dönem henüz bitmedi
      total_credits_earned: 29,
      total_ects_earned: 47,
      current_semester: 4
    }, { where: { id: student1.id } });

    // Ayşe: 2 ders geçti
    await Student.update({
      gpa: 2.00,
      cgpa: 2.00,
      semester_gpa: 0,
      total_credits_earned: 8,
      total_ects_earned: 12,
      current_semester: 4
    }, { where: { id: student2.id } });

    console.log('2. sınıf öğrenci simülasyonu tamamlandı!'.cyan.bold);


    // -----------------------------------------------------------------------
    // 12. BİLDİRİM TERCİHLERİ (NOTIFICATION PREFERENCES) - PART 4
    // -----------------------------------------------------------------------
    if (NotificationPreference) {
      await NotificationPreference.create({
        user_id: userStu1.id,
        email_academic: true,
        email_attendance: true,
        email_meal: false,
        email_event: true,
        email_payment: true,
        email_system: true,
        push_academic: true,
        push_attendance: true,
        push_meal: true,
        push_event: true,
        push_payment: true,
        push_system: true
      });

      await NotificationPreference.create({
        user_id: userStu2.id
      });

      console.log('Bildirim tercihleri eklendi...'.green);
    }

    // -----------------------------------------------------------------------
    // 13. ÖRNEK BİLDİRİMLER (NOTIFICATIONS) - PART 4
    // -----------------------------------------------------------------------
    if (Notification) {
      await Notification.create({
        user_id: userStu1.id,
        title: 'Derse Hoşgeldiniz',
        message: 'CENG102 - Veri Yapıları dersine kaydınız başarıyla tamamlandı.',
        category: 'academic',
        type: 'success',
        link: '/my-courses',
        is_read: false
      });

      await Notification.create({
        user_id: userStu1.id,
        title: 'Yeni Etkinlik',
        message: 'Bahar Teknoloji Şenliği 10 gün sonra başlıyor!',
        category: 'event',
        type: 'info',
        link: '/events',
        is_read: false
      });

      await Notification.create({
        user_id: userStu1.id,
        title: 'Cüzdan Bakiyesi',
        message: 'Cüzdan bakiyeniz 500 TL olarak güncellendi.',
        category: 'payment',
        type: 'success',
        link: '/wallet',
        is_read: true
      });

      await Notification.create({
        user_id: userStu2.id,
        title: 'Burs Ödemesi',
        message: 'Aylık burs ödemesi hesabınıza yatırıldı.',
        category: 'payment',
        type: 'success',
        link: '/wallet',
        is_read: false
      });

      await Notification.create({
        user_id: userFac1.id,
        title: 'Yeni Öğrenci Kayıtları',
        message: 'CENG102 dersine 1 yeni öğrenci kaydoldu.',
        category: 'academic',
        type: 'info',
        link: '/attendance/reports',
        is_read: false
      });

      console.log('Örnek bildirimler eklendi...'.green);
    }

    // -----------------------------------------------------------------------
    // 14. AUDIT LOG KAYITLARI - PART 4
    // -----------------------------------------------------------------------
    if (AuditLog) {
      await AuditLog.create({
        user_id: userStu1.id,
        action: 'login_success',
        description: 'Kullanıcı başarıyla giriş yaptı',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
      });

      await AuditLog.create({
        user_id: userStu1.id,
        action: 'create',
        entity_type: 'Enrollment',
        description: 'CENG102 dersine kayıt oluşturuldu',
        ip_address: '192.168.1.100'
      });

      await AuditLog.create({
        user_id: userFac1.id,
        action: 'login_success',
        description: 'Akademisyen giriş yaptı',
        ip_address: '192.168.1.150'
      });

      await AuditLog.create({
        action: 'login_failed',
        description: 'Başarısız giriş denemesi - geçersiz şifre',
        ip_address: '192.168.1.200',
        metadata: { email: 'hacker@example.com' }
      });

      console.log('Audit log kayıtları eklendi...'.green);
    }

    console.log('-------------------------------------------'.white);
    console.log('VERİ YÜKLEME İŞLEMİ BAŞARIYLA TAMAMLANDI!'.inverse.green);
    console.log('-------------------------------------------'.white);

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();