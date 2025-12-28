module.exports = (sequelize, DataTypes) => {
    const EventWaitlist = sequelize.define('EventWaitlist', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        event_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        position: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Position in the waitlist queue'
        },
        joined_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        notified_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the user was notified about an available spot'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Deadline to accept the spot (24 hours after notification)'
        },
        status: {
            type: DataTypes.ENUM('waiting', 'notified', 'promoted', 'expired', 'cancelled'),
            defaultValue: 'waiting',
            comment: 'waiting: in queue, notified: spot available, promoted: registered, expired: missed window, cancelled: left waitlist'
        }
    }, {
        indexes: [
            {
                unique: true,
                fields: ['event_id', 'user_id']
            },
            {
                fields: ['event_id', 'status']
            },
            {
                fields: ['event_id', 'position']
            }
        ]
    });

    EventWaitlist.associate = (models) => {
        EventWaitlist.belongsTo(models.Event, { foreignKey: 'event_id' });
        EventWaitlist.belongsTo(models.User, { foreignKey: 'user_id' });
    };

    return EventWaitlist;
};
