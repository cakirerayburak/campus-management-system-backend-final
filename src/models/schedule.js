module.exports = (sequelize, DataTypes) => {
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    classroom_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    day_of_week: {
      type: DataTypes.ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    // Yeni: Schedule onay durumu
    status: {
      type: DataTypes.ENUM('draft', 'approved', 'rejected', 'archived'),
      defaultValue: 'draft',
      allowNull: false,
      comment: 'draft: Onay bekliyor, approved: Aktif kullanımda, rejected: Reddedildi, archived: Arşivlendi'
    },
    // Batch ID: Aynı anda oluşturulan programları gruplamak için
    batch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Aynı generate işleminde oluşturulan schedule\'ları gruplar'
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Onaylayan admin kullanıcı ID'
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  Schedule.associate = (models) => {
    Schedule.belongsTo(models.CourseSection, { foreignKey: 'section_id', as: 'section' });
    Schedule.belongsTo(models.Classroom, { foreignKey: 'classroom_id', as: 'classroom' });
  };

  return Schedule;
};