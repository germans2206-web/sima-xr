#!/usr/bin/env node
// =====================================================================
// SIMA · Crear (o resetear) un usuario directo en D1, desde la terminal.
// Hace falta para el PRIMER administrador (nadie puede entrar todavía
// al panel de Configuración → Usuarios para crearlo). Para el resto del
// personal, después del primero, es más cómodo hacerlo desde la app.
//
// Uso:
//   node scripts/crear-usuario.mjs german.dominguez@frigomerc.com.py "Germán Domínguez" inspeccion "unaContraseñaSegura" --remote
//   node scripts/crear-usuario.mjs correo@empresa.com "Nombre Apellido" mantenimiento "contraseña123" --local
//
// --remote escribe en la base ya publicada; --local en la que usa
// `npm run dev`. Si el correo ya existe, lo reemplaza (sirve para
// resetear una contraseña olvidada sin pasar por el panel).
// =====================================================================
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , email, nombre, rol, password, modoFlag] = process.argv;
const ROLES_VALIDOS = ['inspeccion', 'mantenimiento', 'calidad', 'vista'];

if (!email || !nombre || !rol || !password) {
  console.error(`
Uso: node scripts/crear-usuario.mjs <correo> "<nombre>" <rol> "<contraseña>" [--remote|--local]

  rol: inspeccion | mantenimiento | calidad | vista (sólo lectura)
  Por defecto usa --remote (la base publicada). Pasá --local para la de \`npm run dev\`.
`);
  process.exit(1);
}
if (!ROLES_VALIDOS.includes(rol)) {
  console.error(`Rol inválido: "${rol}". Usá uno de: ${ROLES_VALIDOS.join(', ')}`);
  process.exit(1);
}
if (password.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const correo = email.trim().toLowerCase();
const sal = randomBytes(16);
const hash = pbkdf2Sync(password, sal, 100000, 32, 'sha256');
const hashB64 = hash.toString('base64url');
const salB64 = sal.toString('base64url');
const ahora = new Date().toISOString();

const sql = `
INSERT INTO usuarios (email,nombre,rol,hash,sal,activo,creado,creado_por)
VALUES ('${correo.replace(/'/g, "''")}', '${nombre.replace(/'/g, "''")}', '${rol}', '${hashB64}', '${salB64}', 1, '${ahora}', 'terminal')
ON CONFLICT(email) DO UPDATE SET
  nombre=excluded.nombre, rol=excluded.rol, hash=excluded.hash, sal=excluded.sal,
  activo=1, creado_por='terminal (reset)';
`;

const tmpFile = join(tmpdir(), `sima-usuario-${Date.now()}.sql`);
writeFileSync(tmpFile, sql, 'utf8');

const modo = modoFlag === '--local' ? '--local' : '--remote';
try {
  console.log(`Escribiendo en D1 (${modo === '--local' ? 'local' : 'producción'})…`);
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'sima-ra-db', modo, '--file=' + tmpFile], { stdio: 'inherit' });
  console.log(`\nListo: ${correo} → ${rol}. Ya puede iniciar sesión en la app.`);
} finally {
  unlinkSync(tmpFile);
}
