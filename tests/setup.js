/**
 * Jest Test Setup
 * Her test dosyası için veritabanı bağlantısını yönetir
 */

const db = require('../src/models');

// Test başlamadan önce
beforeAll(async () => {
    // Test ortamında veritabanı senkronizasyonu global olarak yapılmaz
    // Her test dosyası kendi sync işlemini yapar
});

// Tüm testler bittikten sonra
afterAll(async () => {
    try {
        // Veritabanı bağlantısını kapat
        if (db.sequelize && db.sequelize.close) {
            await db.sequelize.close();
        }
    } catch (error) {
        // Bağlantı zaten kapalıysa hata verme
        if (!error.message.includes('closed')) {
            console.error('Cleanup error:', error);
        }
    }
});

// Global test timeout
jest.setTimeout(60000);
