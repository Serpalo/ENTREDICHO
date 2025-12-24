import { createClient } from '@supabase/supabase-js';

// 1. Pega aquí tu Project URL (ej: https://xyz.supabase.co)
const supabaseUrl = 'https://exjnlzyifvvasuiozynv.supabase.co';

// 2. Pega aquí tu Anon Public Key (la que acabas de encontrar)
const supabaseKey = 'sb_publishable_Wra8uCeiB_6hH3lPICVXLg_gdkiGsi_';

export const supabase = createClient(supabaseUrl, supabaseKey);
