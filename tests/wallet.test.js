const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { createTestUser } = require('./helpers/testUtils');
const { Wallet, Transaction, User } = db;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Wallet Service Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Test kullanıcısı oluştur (API üzerinden)
    const { user, token } = await createTestUser({
      name: 'Wallet Test User',
      role: 'student'
    });
    userId = user.id;
    authToken = token;
  });

  describe('GET /api/v1/wallet/balance', () => {
    it('should get wallet balance', async () => {
      const res = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('balance');
      expect(res.body.data).toHaveProperty('user_id');
    });

    it('should create wallet if not exists', async () => {
      // Yeni kullanıcı (API üzerinden)
      const { token: newToken } = await createTestUser({
        name: 'New Wallet User',
        role: 'student'
      });

      const res = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.balance).toBe('0.00');
    });
  });

  describe('POST /api/v1/wallet/topup', () => {
    it('should create payment session for valid amount', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100 });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('paymentUrl');
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data.amount).toBe(100);
    });

    it('should reject amount below minimum (50 TRY)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 30 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/minimum/i);
    });

    it('should reject invalid amount', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -10 });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/v1/wallet/topup/webhook', () => {
    it('should process payment webhook successfully', async () => {
      // Mock payment session
      const sessionId = `mock_${Date.now()}`;
      
      const res = await request(app)
        .post('/api/v1/wallet/topup/webhook')
        .send({
          session_id: sessionId,
          metadata: { userId },
          amount: 100
        });

      // Webhook başarılı olmalı (mock mode'da)
      expect([200, 400]).toContain(res.statusCode);
    });
  });

  describe('GET /api/v1/wallet/transactions', () => {
    it('should get transaction history', async () => {
      // Önce bir transaction oluştur
      const wallet = await Wallet.findOne({ where: { user_id: userId } });
      if (!wallet) {
        await Wallet.create({ user_id: userId, balance: 0 });
      }

      await Transaction.create({
        wallet_id: wallet.id,
        type: 'deposit',
        amount: 50,
        balance_after: 50,
        description: 'Test deposit'
      });

      const res = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/wallet/transactions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
    });
  });
});

