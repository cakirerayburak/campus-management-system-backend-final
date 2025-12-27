const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true, // Sistem işlemleri için null olabilir
            references: {
                model: 'users',
                key: 'id'
            }
        },
        action: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: 'İşlem tipi: login, logout, create, update, delete, view, export, etc.'
        },
        entity_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Etkilenen entity: User, Course, Enrollment, etc.'
        },
        entity_id: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Etkilenen kaydın ID\'si'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'İşlem açıklaması'
        },
        old_value: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Değişiklik öncesi değer'
        },
        new_value: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Değişiklik sonrası değer'
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
            comment: 'Kullanıcı IP adresi'
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Tarayıcı/cihaz bilgisi'
        },
        request_method: {
            type: DataTypes.STRING(10),
            allowNull: true,
            comment: 'HTTP method: GET, POST, PUT, DELETE'
        },
        request_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'İstek yapılan URL'
        },
        status_code: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'HTTP response status code'
        },
        duration_ms: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'İşlem süresi (milisaniye)'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Ek veriler'
        }
    }, {
        tableName: 'audit_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false, // Audit log'lar güncellenmiyor
        indexes: [
            { fields: ['user_id'] },
            { fields: ['action'] },
            { fields: ['entity_type'] },
            { fields: ['entity_id'] },
            { fields: ['created_at'] },
            { fields: ['ip_address'] }
        ]
    });

    AuditLog.associate = (models) => {
        AuditLog.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    return AuditLog;
};
