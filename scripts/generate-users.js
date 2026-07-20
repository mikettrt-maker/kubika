/**
 * Script para generar 100 usuarios alumnos pre-creados para Kubika.
 * 
 * Uso:
 *   1. Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY abajo
 *   2. Ejecuta: node scripts/generate-users.js
 *   3. Se generará un archivo CSV con las credenciales para imprimir y entregar a los alumnos
 * 
 * IMPORTANTE: Usa la SERVICE_ROLE_KEY (no la anon key) porque necesita permisos admin
 * para crear usuarios directamente.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== CONFIGURACIÓN ==========
// Reemplaza estos valores con tus credenciales de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'TU_SUPABASE_URL_AQUI';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'TU_SERVICE_ROLE_KEY_AQUI';

const TOTAL_USERS = 100;
const PASSWORD_LENGTH = 6;

// ========== GENERADOR DE CONTRASEÑAS ==========

/**
 * Genera una contraseña de 6 caracteres con letras, dígitos y símbolos.
 * Ejemplo: "k3$Lm@"
 */
function generatePassword() {
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // sin l (confusión con 1)
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // sin I, O (confusión)
  const digits = '23456789'; // sin 0, 1 (confusión con O, l)
  const symbols = '@#$%&*!?';

  // Asegurar al menos uno de cada tipo
  const required = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  // Completar el resto
  const allChars = lowercase + uppercase + digits + symbols;
  while (required.length < PASSWORD_LENGTH) {
    required.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  // Mezclar (Fisher-Yates shuffle)
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
}

// ========== GENERAR LISTA DE USUARIOS ==========

function generateUserList() {
  const users = [];

  for (let i = 1; i <= TOTAL_USERS; i++) {
    const num = String(i).padStart(3, '0'); // 001, 002, ... 100
    const username = `kubika.alumno${num}`;
    const email = `${username}@kubika.app`;
    const password = generatePassword();

    users.push({
      number: i,
      username,
      email,
      password,
      displayName: `Alumno ${num}`,
    });
  }

  return users;
}

// ========== CREAR USUARIOS EN SUPABASE ==========

async function createUsersInSupabase(users) {
  // Importar dinámicamente el cliente de Supabase
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`\n🚀 Creando ${users.length} usuarios en Supabase...\n`);

  let created = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Confirmar email automáticamente
        user_metadata: {
          display_name: user.displayName,
          username: user.username,
        },
      });

      if (error) {
        // Si el usuario ya existe, no es un error crítico
        if (error.message.includes('already been registered')) {
          console.log(`⚠️  ${user.username} ya existe, saltando...`);
        } else {
          console.error(`❌ Error con ${user.username}: ${error.message}`);
          errors++;
        }
      } else {
        console.log(`✅ ${user.username} creado`);
        created++;
      }
    } catch (err) {
      console.error(`❌ Error con ${user.username}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Resumen: ${created} creados, ${errors} errores\n`);
}

// ========== GENERAR CSV ==========

function generateCSV(users) {
  // CSV con las credenciales
  let csv = 'Numero,Usuario,Email,Contraseña\n';
  users.forEach(u => {
    csv += `${u.number},${u.username},${u.email},${u.password}\n`;
  });

  const csvPath = path.join(__dirname, '..', 'kubika-usuarios.csv');
  fs.writeFileSync(csvPath, csv, 'utf-8');
  console.log(`📄 CSV guardado en: ${csvPath}`);

  // También generar una versión para imprimir (tarjetas recortables)
  let printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Kubika - Tarjetas de Acceso</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; }
    .page { page-break-after: always; padding: 10mm; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
    .card {
      border: 1.5px dashed #ccc;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      break-inside: avoid;
    }
    .card .logo { font-size: 18px; font-weight: 800; color: #4c6ef5; margin-bottom: 4px; }
    .card .sub { font-size: 9px; color: #999; margin-bottom: 8px; }
    .card .field { margin: 4px 0; }
    .card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .card .value { font-size: 13px; font-weight: 700; color: #333; font-family: 'Courier New', monospace; }
    .card .divider { border-top: 1px solid #eee; margin: 6px 0; }
    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding: 20px; background: #f0f4ff; text-align: center; margin-bottom: 20px;">
    <h2 style="color: #4c6ef5;">Kubika - Tarjetas de Acceso para Alumnos</h2>
    <p>Imprime esta página y recorta las tarjetas por las líneas punteadas.</p>
    <button onclick="window.print()" style="margin-top: 10px; padding: 10px 30px; background: #4c6ef5; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">🖨️ Imprimir</button>
  </div>
`;

  // 9 tarjetas por página (3x3)
  const cardsPerPage = 9;
  for (let page = 0; page < Math.ceil(users.length / cardsPerPage); page++) {
    printHtml += `  <div class="page">\n    <div class="grid">\n`;
    
    for (let i = 0; i < cardsPerPage; i++) {
      const idx = page * cardsPerPage + i;
      if (idx >= users.length) break;
      const u = users[idx];
      
      printHtml += `      <div class="card">
        <div class="logo">K Kubika</div>
        <div class="sub">Regletas de Cuisenaire</div>
        <div class="divider"></div>
        <div class="field">
          <div class="label">Usuario</div>
          <div class="value">${u.username}</div>
        </div>
        <div class="field">
          <div class="label">Contraseña</div>
          <div class="value">${u.password}</div>
        </div>
        <div class="divider"></div>
        <div style="font-size: 8px; color: #aaa;">Alumno #${u.number}</div>
      </div>\n`;
    }
    
    printHtml += `    </div>\n  </div>\n`;
  }

  printHtml += `</body>\n</html>`;

  const htmlPath = path.join(__dirname, '..', 'kubika-tarjetas.html');
  fs.writeFileSync(htmlPath, printHtml, 'utf-8');
  console.log(`🎴 Tarjetas imprimibles guardadas en: ${htmlPath}`);
}

// ========== MAIN ==========

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Kubika - Generador de Usuarios     ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Generar la lista
  const users = generateUserList();
  console.log(`📋 ${users.length} usuarios generados\n`);

  // Siempre generar CSV y tarjetas (no necesita Supabase)
  generateCSV(users);

  // Solo crear en Supabase si las credenciales están configuradas
  if (SUPABASE_URL !== 'TU_SUPABASE_URL_AQUI' && SUPABASE_SERVICE_ROLE_KEY !== 'TU_SERVICE_ROLE_KEY_AQUI') {
    await createUsersInSupabase(users);
  } else {
    console.log('\n⚠️  Supabase NO configurado.');
    console.log('   Para crear los usuarios en Supabase, configura las variables:');
    console.log('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-users.js\n');
    console.log('   Por ahora se generaron el CSV y las tarjetas imprimibles.\n');
  }

  // Mostrar los primeros 5 usuarios de ejemplo
  console.log('──────────────────────────────────────');
  console.log('📋 Primeros 5 usuarios de ejemplo:\n');
  users.slice(0, 5).forEach(u => {
    console.log(`   👤 ${u.username}  🔑 ${u.password}`);
  });
  console.log('\n──────────────────────────────────────');
  console.log('✅ ¡Listo! Revisa los archivos generados.');
}

main().catch(console.error);
