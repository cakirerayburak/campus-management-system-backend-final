module.exports = {
  testEnvironment: 'node',
  verbose: true,
  // Tüm test dosyaları
  testMatch: [
    '**/tests/*.test.js'
  ],
  // Çalıştırılmayacak testler (sorunlu olanlar)
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  // Timeout ayarları
  testTimeout: 60000,
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
  ],
  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  // Test çıktısı ayarları
  silent: false
};