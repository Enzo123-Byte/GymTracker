import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Création du client Supabase
// On vérifie si la librairie est chargée pour éviter les erreurs
if (!window.supabase) {
    console.error("La librairie Supabase n'est pas chargée dans le HTML !");
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);