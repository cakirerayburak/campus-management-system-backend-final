/**
 * Audit Service
 * Sistem işlemlerini loglama servisi
 */

// Lazy loading to avoid circular dependency
let db = null;
const getDb = () => {
    if (!db) {
        db = require('../models');
    }
    return db;
};

/**
 * Audit log oluştur
 * @param {Object} options - Log seçenekleri
 * @param {string} options.userId - Kullanıcı ID (opsiyonel)
 * @param {string} options.action - İşlem tipi (login, logout, create, update, delete, view, export)
 * @param {string} options.entityType - Entity tipi (User, Course, Enrollment, etc.)
 * @param {string} options.entityId - Entity ID
 * @param {string} options.description - İşlem açıklaması
 * @param {Object} options.oldValue - Eski değer
 * @param {Object} options.newValue - Yeni değer
 * @param {Object} options.req - Express request nesnesi (opsiyonel)
 * @param {Object} options.metadata - Ek veriler
 */
const log = async (options) => {
    try {
        const database = getDb();
        if (!database.AuditLog) {
            console.warn('AuditLog modeli bulunamadı, log atlanıyor.');
            return null;
        }

        const {
            userId,
            action,
            entityType,
            entityId,
            description,
            oldValue,
            newValue,
            req,
            statusCode,
            durationMs,
            metadata
        } = options;

        const auditLog = await database.AuditLog.create({
            user_id: userId || req?.user?.id || null,
            action,
            entity_type: entityType,
            entity_id: entityId,
            description,
            old_value: oldValue,
            new_value: newValue,
            ip_address: req?.ip || req?.connection?.remoteAddress || null,
            user_agent: req?.get?.('User-Agent') || null,
            request_method: req?.method || null,
            request_url: req?.originalUrl || null,
            status_code: statusCode,
            duration_ms: durationMs,
            metadata
        });

        return auditLog;
    } catch (error) {
        console.error('Audit log oluşturma hatası:', error);
        return null;
    }
};

/**
 * Kullanıcı girişi logla
 */
const logLogin = async (userId, req, success = true) => {
    return log({
        userId,
        action: success ? 'login_success' : 'login_failed',
        description: success ? 'Kullanıcı başarıyla giriş yaptı' : 'Başarısız giriş denemesi',
        req,
        metadata: { success }
    });
};

/**
 * Kullanıcı çıkışı logla
 */
const logLogout = async (userId, req) => {
    return log({
        userId,
        action: 'logout',
        description: 'Kullanıcı çıkış yaptı',
        req
    });
};

/**
 * Kayıt oluşturma logla
 */
const logCreate = async (userId, entityType, entityId, newValue, req, description = null) => {
    return log({
        userId,
        action: 'create',
        entityType,
        entityId,
        description: description || `${entityType} oluşturuldu`,
        newValue,
        req
    });
};

/**
 * Kayıt güncelleme logla
 */
const logUpdate = async (userId, entityType, entityId, oldValue, newValue, req, description = null) => {
    return log({
        userId,
        action: 'update',
        entityType,
        entityId,
        description: description || `${entityType} güncellendi`,
        oldValue,
        newValue,
        req
    });
};

/**
 * Kayıt silme logla
 */
const logDelete = async (userId, entityType, entityId, oldValue, req, description = null) => {
    return log({
        userId,
        action: 'delete',
        entityType,
        entityId,
        description: description || `${entityType} silindi`,
        oldValue,
        req
    });
};

/**
 * Veri görüntüleme logla (hassas veriler için)
 */
const logView = async (userId, entityType, entityId, req, description = null) => {
    return log({
        userId,
        action: 'view',
        entityType,
        entityId,
        description: description || `${entityType} görüntülendi`,
        req
    });
};

/**
 * Export işlemi logla
 */
const logExport = async (userId, entityType, req, metadata = {}) => {
    return log({
        userId,
        action: 'export',
        entityType,
        description: `${entityType} verileri export edildi`,
        req,
        metadata
    });
};

/**
 * Özel işlem logla
 */
const logAction = async (userId, action, description, req, options = {}) => {
    return log({
        userId,
        action,
        description,
        req,
        ...options
    });
};

module.exports = {
    log,
    logLogin,
    logLogout,
    logCreate,
    logUpdate,
    logDelete,
    logView,
    logExport,
    logAction
};
