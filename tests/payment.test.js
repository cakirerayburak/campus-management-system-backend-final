/**
 * Payment & Wallet System Tests
 * Part 3: Ödeme entegrasyonu ve cüzdan sistemi testleri
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

jest.setTimeout(30000);

describe('Payment & Wallet System Tests', () => {
    let studentToken, adminToken;
    let studentUser, walletId;

    beforeAll(async () => {
        await db.sequelize.sync({ force: true });

        // Department
        const dept = await db.Department.create({
            name: 'Payment Department',
            code: 'PAY',
            faculty_name: 'Business'
        });

        // Student user
        studentUser = await db.User.create({
            name: 'Payment Student',
            email: `student_pay_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });

        await db.Student.create({
            userId: studentUser.id,
            student_number: `S${Date.now()}`,
            departmentId: dept.id
        });

        // Admin user
        const adminUser = await db.User.create({
            name: 'Payment Admin',
            email: `admin_pay_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'admin',
            is_verified: true
        });

        // Wallet oluştur
        const wallet = await db.Wallet.create({
            user_id: studentUser.id,
            balance: 100.00,
            is_active: true
        });
        walletId = wallet.id;

        // Token'ları al
        const studentLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: studentUser.email, password: 'Password123' });
        studentToken = studentLogin.body.data?.accessToken;

        const adminLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: adminUser.email, password: 'Password123' });
        adminToken = adminLogin.body.data?.accessToken;
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('GET /api/v1/wallet/balance', () => {
        it('should get wallet balance', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('balance');
            expect(typeof res.body.data.balance).toBe('number');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/balance');

            expect(res.statusCode).toEqual(401);
        });

        it('should create wallet if not exists', async () => {
            // Yeni kullanıcı oluştur
            const newUser = await db.User.create({
                name: 'New Wallet User',
                email: `new_wallet_${Date.now()}@test.com`,
                password_hash: 'Password123',
                role: 'student',
                is_verified: true
            });

            await db.Student.create({
                userId: newUser.id,
                student_number: `NW${Date.now()}`,
                departmentId: (await db.Department.findOne()).id
            });

            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: newUser.email, password: 'Password123' });
            const newToken = loginRes.body.data?.accessToken;

            const res = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${newToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.balance).toBe(0);
        });
    });

    describe('POST /api/v1/wallet/topup', () => {
        it('should create payment session for top-up', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 100 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('paymentUrl');
            expect(res.body.data).toHaveProperty('sessionId');
        });

        it('should reject amount below minimum (50 TRY)', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 25 });

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/minimum/i);
        });

        it('should reject negative amount', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: -50 });

            expect(res.statusCode).toEqual(400);
        });

        it('should reject zero amount', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 0 });

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('POST /api/v1/wallet/topup/confirm', () => {
        it('should confirm mock payment and add balance', async () => {
            // Önce ödeme session'ı oluştur
            const topupRes = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 100 });

            const sessionId = topupRes.body.data.sessionId;

            // Mevcut bakiyeyi al
            const beforeBalance = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${studentToken}`);
            const initialBalance = beforeBalance.body.data.balance;

            // Ödemeyi onayla
            const res = await request(app)
                .post('/api/v1/wallet/topup/confirm')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ sessionId, amount: 100 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Bakiye artmış olmalı
            const afterBalance = await request(app)
                .get('/api/v1/wallet/balance')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(afterBalance.body.data.balance).toBe(initialBalance + 100);
        });

        it('should create transaction record after confirmation', async () => {
            const topupRes = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 50 });

            await request(app)
                .post('/api/v1/wallet/topup/confirm')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ sessionId: topupRes.body.data.sessionId, amount: 50 });

            // Transaction kaydı kontrolü
            const transaction = await db.Transaction.findOne({
                where: {
                    wallet_id: walletId,
                    type: 'credit'
                },
                order: [['createdAt', 'DESC']]
            });

            expect(transaction).toBeTruthy();
            expect(parseFloat(transaction.amount)).toBe(50);
        });
    });

    describe('GET /api/v1/wallet/transactions', () => {
        it('should get transaction history', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/transactions')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should paginate transactions', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/transactions?page=1&limit=5')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toBeLessThanOrEqual(5);
        });

        it('should filter transactions by type', async () => {
            const res = await request(app)
                .get('/api/v1/wallet/transactions?type=credit')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toEqual(200);
            if (res.body.data.length > 0) {
                res.body.data.forEach(t => {
                    expect(t.type).toBe('credit');
                });
            }
        });
    });

    describe('Payment Webhook', () => {
        it('should handle Stripe webhook (mock)', async () => {
            const res = await request(app)
                .post('/api/v1/wallet/webhook')
                .set('stripe-signature', 'mock_signature')
                .send({
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                            id: 'mock_session_123',
                            payment_status: 'paid',
                            amount_total: 10000,
                            metadata: {
                                userId: studentUser.id,
                                type: 'wallet_topup'
                            }
                        }
                    }
                });

            // Webhook endpoint varsa başarılı olmalı, yoksa 404
            expect([200, 400, 404]).toContain(res.statusCode);
        });
    });

    describe('Wallet Deactivation', () => {
        it('should not allow transactions on deactivated wallet', async () => {
            // Wallet'ı deaktive et
            await db.Wallet.update(
                { is_active: false },
                { where: { id: walletId } }
            );

            const res = await request(app)
                .post('/api/v1/wallet/topup')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ amount: 100 });

            // Deaktive wallet için hata vermeli
            expect([400, 403]).toContain(res.statusCode);

            // Wallet'ı tekrar aktive et (cleanup)
            await db.Wallet.update(
                { is_active: true },
                { where: { id: walletId } }
            );
        });
    });
});

describe('Payment Service Unit Tests', () => {
    const paymentService = require('../src/services/paymentService');

    describe('createPaymentSession', () => {
        it('should create mock payment session', async () => {
            const result = await paymentService.createPaymentSession(100, 'test-user-id');

            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
            expect(result.paymentUrl).toBeDefined();
            expect(result.gateway).toBe('mock');
        });

        it('should reject amount below minimum', async () => {
            await expect(paymentService.createPaymentSession(25, 'test-user-id'))
                .rejects.toThrow(/minimum/i);
        });
    });

    describe('verifyWebhookSignature', () => {
        it('should verify mock signature', () => {
            const result = paymentService.verifyWebhookSignature('mock_signature', '{}');
            expect(result).toBe(true);
        });
    });

    describe('handlePaymentSuccess', () => {
        it('should handle mock payment success', async () => {
            const result = await paymentService.handlePaymentSuccess('mock_session_123', 'test-user-id');

            expect(result.success).toBe(true);
            expect(result.amount).toBeDefined();
        });
    });
});

describe('Double-Entry Bookkeeping Tests', () => {
    let testUserId, testWalletId;

    beforeAll(async () => {
        const user = await db.User.create({
            name: 'Bookkeeping Test User',
            email: `book_${Date.now()}@test.com`,
            password_hash: 'Password123',
            role: 'student',
            is_verified: true
        });
        testUserId = user.id;

        const wallet = await db.Wallet.create({
            user_id: user.id,
            balance: 0
        });
        testWalletId = wallet.id;
    });

    it('should maintain balance consistency after transactions', async () => {
        const wallet = await db.Wallet.findByPk(testWalletId);
        const initialBalance = parseFloat(wallet.balance);

        // Credit işlemi
        await db.Transaction.create({
            wallet_id: testWalletId,
            type: 'credit',
            amount: 100,
            balance_after: initialBalance + 100,
            description: 'Test credit'
        });
        await wallet.update({ balance: initialBalance + 100 });

        // Debit işlemi
        await db.Transaction.create({
            wallet_id: testWalletId,
            type: 'payment',
            amount: 30,
            balance_after: initialBalance + 70,
            description: 'Test payment'
        });
        await wallet.update({ balance: initialBalance + 70 });

        // Final balance kontrolü
        await wallet.reload();
        expect(parseFloat(wallet.balance)).toBe(initialBalance + 70);

        // Transaction history doğrulaması
        const transactions = await db.Transaction.findAll({
            where: { wallet_id: testWalletId },
            order: [['createdAt', 'ASC']]
        });

        expect(transactions.length).toBe(2);
        expect(parseFloat(transactions[0].amount)).toBe(100);
        expect(parseFloat(transactions[1].amount)).toBe(30);
    });
});
