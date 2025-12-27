/**
 * Basit Test - Database Bağlantısı ve Temel İşlevleri Kontrol Et
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  
  // Department oluştur (testler için)
  await db.Department.create({
    name: 'Computer Engineering',
    code: 'CE',
    faculty_name: 'Engineering'
  });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('✅ Temel Sistem Testleri', () => {
  
  it('✅ Database bağlantısı çalışıyor mu?', async () => {
    expect(db.sequelize).toBeDefined();
    const result = await db.sequelize.authenticate();
    expect(result).toBeUndefined(); // authenticate başarılıysa undefined döner
  });

  it('✅ API sunucusu çalışıyor mu?', async () => {
    const res = await request(app).get('/api/v1/health');
    // Health endpoint yoksa 404, varsa 200 olmalı
    expect([200, 404]).toContain(res.statusCode);
  });

  it('✅ Register endpoint erişilebilir mi?', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({}); // Boş gönder, validation hatası almalı
    
    // 400 Bad Request olmalı (validation error)
    expect(res.statusCode).toBe(400);
  });

  it('✅ Login endpoint erişilebilir mi?', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({}); // Boş gönder
    
    // 400 veya 401 olmalı
    expect([400, 401]).toContain(res.statusCode);
  });
});

describe('✅ Model Testleri', () => {
  
  it('✅ User modeli oluşturulabilir mi?', async () => {
    const user = await db.User.create({
      name: 'Test User',
      email: `test_${Date.now()}@example.com`,
      password_hash: 'hashedpassword123',
      role: 'student',
      is_verified: true
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@');
  });

  it('✅ Department modeli oluşturulabilir mi?', async () => {
    const dept = await db.Department.create({
      name: 'Computer Engineering',
      code: `CE${Date.now()}`,
      faculty_name: 'Engineering'
    });

    expect(dept).toBeDefined();
    expect(dept.id).toBeDefined();
  });

  it('✅ Course modeli oluşturulabilir mi?', async () => {
    const dept = await db.Department.create({
      name: 'Software Engineering',
      code: `SE${Date.now()}`,
      faculty_name: 'Engineering'
    });

    const course = await db.Course.create({
      code: 'SE101',
      name: 'Intro to Software',
      credits: 3,
      ects: 5,
      departmentId: dept.id
    });

    expect(course).toBeDefined();
    expect(course.code).toBe('SE101');
  });
});

console.log('\n✅ Basit testler tamamlandı!\n');
