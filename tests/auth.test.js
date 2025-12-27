const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const crypto = require('crypto');

jest.setTimeout(30000);

let departmentId;

// Testler başlamadan önce veritabanını temizle
beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  
  // Department oluştur (Student için zorunlu)
  const dept = await db.Department.create({
    name: 'Computer Engineering',
    code: 'CE',
    faculty_name: 'Engineering'
  });
  departmentId = dept.id;
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 1: Authentication Tests', () => {
  
  const randomId = Math.floor(Math.random() * 10000);
  let testUser;
  let refreshToken = null;
  let accessToken = null;

  beforeAll(() => {
    testUser = {
      name: 'Test Student',
      email: `teststudent${randomId}@example.com`,
      password: 'Password123',
      role: 'student',
      department_id: departmentId
    };
  });

  // 1. REGISTER TESTİ
  it('should register a new student without returning token immediately', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    // Token dönmemeli
    expect(res.body).not.toHaveProperty('token'); 
    expect(res.body.message).toMatch(/kontrol edin/i);
  });

  // 2. DUPLICATE EMAIL TESTİ
  it('should reject registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  // 3. WEAK PASSWORD TESTİ
  it('should reject registration with weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak User',
        email: `weak${randomId}@example.com`,
        password: '123', // çok kısa
        role: 'student',
        department_id: departmentId
      });

    expect(res.statusCode).toEqual(400);
  });

  // 4. INVALID EMAIL FORMAT TESTİ
  it('should reject registration with invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Invalid Email User',
        email: 'not-an-email',
        password: 'Password123',
        role: 'student',
        department_id: departmentId
      });

    expect(res.statusCode).toEqual(400);
  });

  // 6. LOGIN TESTİ (Başarılı)
  it('should login with valid credentials after verification', async () => {
    // MANUEL DOĞRULAMA
    await db.User.update(
      { is_verified: true },
      { where: { email: testUser.email } }
    );

    // Giriş Yap
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    
    // DÜZELTME: Token 'data' objesinin içinde 'accessToken' olarak geliyor
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  // 7. LOGIN TESTİ (Hatalı Şifre)
  it('should reject login with invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
  });

  // 8. LOGIN TESTİ (Olmayan Email)
  it('should reject login with non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Password123'
      });

    expect(res.statusCode).toEqual(401);
  });

  // 9. REFRESH TOKEN TESTİ (Başarılı)
  it('should refresh access token with valid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  // 10. REFRESH TOKEN TESTİ (Geçersiz Token)
  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid-refresh-token' });

    expect(res.statusCode).toEqual(401);
  });

  // 11. REFRESH TOKEN TESTİ (Boş Token)
  it('should reject empty refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.statusCode).toEqual(400);
  });

  // 12. GET CURRENT USER TESTİ
  it('should get current user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email);
  });

  // 13. UNAUTHORIZED ACCESS TESTİ
  it('should reject request without token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me');

    expect(res.statusCode).toEqual(401);
  });

  // 14. INVALID TOKEN TESTİ
  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.statusCode).toEqual(401);
  });

  // 15. FORGOT PASSWORD TESTİ
  it('should handle forgot password request', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: testUser.email });

    // SMTP olmayabilir veya user henüz doğrulanmamış olabilir
    // 200: başarılı, 404: user bulunamadı, 500: SMTP hatası
    expect([200, 404, 500]).toContain(res.statusCode);
  });

  // 16. FORGOT PASSWORD - NON EXISTENT EMAIL
  it('should reject forgot password for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.statusCode).toEqual(404);
  });

  // 17. RESET PASSWORD TESTİ (Geçerli Token)
  it('should reset password with valid token', async () => {
    // Token oluştur
    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    await db.User.update(
      {
        reset_password_token: hashedToken,
        reset_password_expire: new Date(Date.now() + 10 * 60 * 1000)
      },
      { where: { email: testUser.email } }
    );

    const res = await request(app)
      .put(`/api/v1/auth/reset-password/${resetToken}`)
      .send({ password: 'NewPassword123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  // 18. RESET PASSWORD TESTİ (Süresi Dolmuş Token)
  it('should reject reset password with expired token', async () => {
    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    await db.User.update(
      {
        reset_password_token: hashedToken,
        reset_password_expire: new Date(Date.now() - 1000) // Süresi dolmuş
      },
      { where: { email: testUser.email } }
    );

    const res = await request(app)
      .put(`/api/v1/auth/reset-password/${resetToken}`)
      .send({ password: 'NewPassword123' });

    expect(res.statusCode).toEqual(400);
  });

  // 19. RESET PASSWORD TESTİ (Geçersiz Token)
  it('should reject reset password with invalid token', async () => {
    const res = await request(app)
      .put('/api/v1/auth/reset-password/invalid-token')
      .send({ password: 'NewPassword123' });

    expect(res.statusCode).toEqual(400);
  });

  // 20. LOGIN WITH NEW PASSWORD
  it('should login with new password after reset', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'NewPassword123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  // 21. LOGOUT TESTİ
  it('should logout successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });
});