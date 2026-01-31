#!/usr/bin/env node

/**
 * Script para ejecutar migraciones solo si DATABASE_URL está configurada
 * Esto previene errores durante el build en Vercel cuando la DB no está configurada
 */

const { execSync } = require('node:child_process');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim() === '') {
  console.log('⚠️  DATABASE_URL not set, skipping migrations');
  process.exit(0);
}

try {
  console.log('🔄 Running database migrations...');
  execSync('npm run db:migrate', { stdio: 'inherit' });
  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  // En producción, no fallar el build si las migraciones fallan
  // (puede ser que la DB no esté lista aún)
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Continuing build despite migration failure (production mode)');
    process.exit(0);
  }
  process.exit(1);
}
