'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const db = {};

// .env dosyasını yükle
require('dotenv').config();

let sequelize;
const env = process.env.NODE_ENV || 'development';

// TEST ORTAMI: config.json kullan (SQLite :memory:)
if (env === 'test') {
  const config = require(path.join(__dirname, '../../config/config.json'))[env];
  
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
  }
}
// 1. PRODUCTION/DEVELOPMENT: Railway DATABASE_URL
else if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    port: 5432,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true, 
        rejectUnauthorized: false
      }
    }
  });
} 
// 2. LOCAL DEVELOPMENT: DB_NAME, DB_USER, DB_PASS
else if (process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASS) {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: 'postgres',
      port: process.env.DB_PORT || 5432,
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      ...(process.env.NODE_ENV === 'production' && {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      })
    }
  );
} else {
  console.error("HATA: Veritabanı bağlantı bilgileri (DATABASE_URL veya DB_... değişkenleri) eksik!");
}

// Model dosyalarını yükleme (değişiklik yok)
if (sequelize) {
  fs
    .readdirSync(__dirname)
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        file.indexOf('.test.js') === -1
      );
    })
    .forEach(file => {
      const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    });

  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
}

module.exports = db;