module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define('Student', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    student_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    gpa: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Cumulative GPA (Genel Not Ortalaması - CGPA)'
    },
    cgpa: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Alias for gpa - Cumulative Grade Point Average'
    },
    semester_gpa: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Current Semester GPA (Dönem Ortalaması)'
    },
    current_semester: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    total_credits_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total credits successfully completed'
    },
    total_ects_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total ECTS successfully completed'
    },
    is_scholarship: { // Part 3: Yemekhane için eklendi
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  Student.associate = (models) => {
    Student.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Student.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Student.hasMany(models.Enrollment, { foreignKey: 'studentId', as: 'enrollments' });
    Student.hasMany(models.AttendanceRecord, { foreignKey: 'studentId' });
  };

  return Student;
};
