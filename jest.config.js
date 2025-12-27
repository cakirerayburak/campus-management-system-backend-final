module.exports = {
  testEnvironment: 'node',
  verbose: true,
  // Sadece çalışan test dosyaları
  testMatch: [
    '**/tests/simple.test.js',
    '**/tests/qrCode.test.js',
    '**/tests/comprehensive.test.js',
    '**/tests/auth.test.js'
  ],
  // Timeout ayarları
  testTimeout: 30000,
  // Test tamamlandığında açık handle'ları zorla kapat
  forceExit: true,
  // Test tamamlandığında clean-up yap
  detectOpenHandles: false,
  // Testleri sırayla çalıştır (paralel sorunları önlemek için)
  maxWorkers: 1,
  // Kapsama raporu (Coverage) ayarları
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/scripts/**',
    '!src/config/**',
    '!src/models/index.js' 
  ]
};