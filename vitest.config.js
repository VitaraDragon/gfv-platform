import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Ambiente di test
    environment: 'node',
    
    // Glob pattern per file di test
    include: ['tests/**/*.test.js'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        '**/*.standalone.html'
      ]
    },
    
    // Timeout per test (in ms)
    testTimeout: 10000,
    
    // Setup file - Mock Firebase prima di eseguire i test
    setupFiles: ['./tests/setup.js'],
    
    // Globals (per usare describe, test, expect senza import)
    globals: true
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@core': resolve(__dirname, './core'),
      '@shared': resolve(__dirname, './shared')
    }
  }
});

