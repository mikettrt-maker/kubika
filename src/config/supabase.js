import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase
 * Lee las credenciales de las variables de entorno.
 * Si no están configuradas, el cliente será null y las funciones
 * de auth/guardado estarán deshabilitadas.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificar si las credenciales están configuradas
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'tu_url_de_supabase_aqui'
);

// Crear el cliente solo si las credenciales están configuradas
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Log de estado en desarrollo
if (import.meta.env.DEV) {
  if (isSupabaseConfigured) {
    console.log('✅ Supabase configurado correctamente');
  } else {
    console.warn(
      '⚠️ Supabase NO configurado. La app funcionará en modo local sin auth ni guardado.\n' +
      'Para activar estas funciones, copia .env.example como .env y completa tus credenciales.'
    );
  }
}
