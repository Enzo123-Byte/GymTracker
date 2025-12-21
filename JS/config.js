// ==========================================
// 1. CONFIGURATION
// ==========================================
const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const PROD_CONFIG = {
    url: 'https://ogoigzenaczqarvrtwgk.supabase.co',
    key: 'sb_publishable_z3zg6qDTotXZblxQ7ZePAw_8A55xtE_'
};
const activeConfig = PROD_CONFIG; 
export const SUPABASE_URL = activeConfig.url;
export const SUPABASE_KEY = activeConfig.key;

export let workouts = {}; 

export const BADGES_CONFIG = [
    { count: 5, icon: '🥉', label: 'Débutant', color: 'text-amber-600 bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
    { count: 10, icon: '🥈', label: 'Habitué', color: 'text-slate-600 bg-slate-200 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
    { count: 20, icon: '🥇', label: 'Athlète', color: 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
    { count: 50, icon: '🏆', label: 'Légende', color: 'text-emerald-600 bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' }
];

// --- CATALOGUE DES SPLITS (2 à 6 jours) ---
export const WIZARD_SPLITS = {
    2: {
        name: "Full Body (2j)",
        days: {
            "Full Body A": ["Développé Couché Barre", "Leg Press Horizontale", "Tirage Vert. Barre", "Élévations Latérales Assis", "Ext. Triceps Corde", "Planche"],
            "Full Body B": ["Soulevé de Terre (Deadlift)", "Dev. Militaire Machine", "Rowing Barre", "Fentes Arrières", "Curl Barre Droite", "Crunch Machine"]
        }
    },
    3: {
        name: "Classic PPL (3j)",
        days: {
            "PUSH (Pecs/Épaules/Tri)": ["Développé Couché Barre", "Développé Arnold", "Écarté Incliné Haltères", "Élévations Latérales Poulie", "Ext. Triceps Corde"],
            "PULL (Dos/Biceps/Arr.)": ["Tirage Vert. Barre", "Rowing Barre", "Face Pull", "Curl Barre Droite", "Curl Marteau"],
            "LEGS (Jambes/Abdos)": ["Squat Barre", "RDL Haltères", "Leg Extension", "Leg Curl Assis", "Ab Wheel (Roulette)"]
        }
    },
    4: {
        name: "Upper / Lower (4j)",
        days: {
            "UPPER A (Force/Base)": ["Développé Couché Barre", "Rowing Barre", "Développé Militaire Barre Debout", "Chin-ups (Tractions Supi)", "Barre au Front (Skullcrusher)"],
            "LOWER A (Quad Focus)": ["Squat Barre", "Leg Press Horizontale", "Fentes Marchées", "Leg Extension", "Toes to Bar"],
            "UPPER B (Volume/Iso)": ["Chest Press", "Tirage Horiz. Machine", "Dips Machine", "Élévations Latérales Assis", "Curl Incliné Haltères"],
            "LOWER B (Chaine Post.)": ["Soulevé de Terre Roumain (RDL)", "Hack Squat", "Leg Curl Allongé", "Hip Thrust Barre", "Planche"]
        }
    },
    5: {
        name: "Hybride U/L + PPL (5j)",
        days: {
            "UPPER (Haut)": ["Développé Couché Barre", "Tirage Vert. Barre", "Développé Arnold", "Rowing Unilatéral Machine", "Face Pull"],
            "LOWER (Bas)": ["Squat Barre", "RDL Haltères", "Leg Extension", "Leg Curl Assis", "Relevé de Jambes"],
            "PUSH (Poussée)": ["Chest Press", "Dips Banc", "Ecarté Pec", "Ext. Triceps Corde", "Élévations Latérales Poulie"],
            "PULL (Tirage)": ["Tirage Vert. Unilatéral", "Tirage Horiz. Machine", "Pull-over Poulie Haute", "Curl Barre Droite", "Curl Marteau"],
            "LEGS (Jambes)": ["Hack Squat", "Fentes Arrières", "Leg Press Horizontale", "Leg Curl Allongé", "Russian Twist"]
        }
    },
    6: {
        name: "Arnold PPL x2 (6j)",
        days: {
            "PUSH A (Pecs Focus)": ["Développé Couché Barre", "Développé Décliné Haltères", "Écarté Poulie Vis-à-vis", "Barre au Front (Skullcrusher)", "Élévations Latérales Assis"],
            "PULL A (Largeur Dos)": ["Tirage Vert. Barre", "Rowing Unilatéral Machine", "Pull-over", "Curl Barre Droite", "Face Pull"],
            "LEGS A (Quad Focus)": ["Squat Barre", "Leg Extension", "Goblet Squat", "Fentes Marchées", "Crunch Machine"],
            "PUSH B (Épaules Focus)": ["Développé Militaire Barre Debout", "Dips Machine", "Élévations Latérales Poulie", "Ext. Triceps Corde", "Pompes"],
            "PULL B (Épaisseur Dos)": ["Rowing Barre", "Tirage Horiz. Machine", "Shrugs Haltères", "Curl Marteau", "Curl Araignée"],
            "LEGS B (Ischios Focus)": ["Soulevé de Terre Roumain (RDL)", "Leg Curl Assis", "Leg Curl Allongé", "Hip Thrust Barre", "Planche"]
        }
    }
};

// --- MODIFICATEURS D'OBJECTIF ---
export const GOAL_MODIFIERS = {
    "FORCE": { sets: 5, reps: "3-5" },
    "HYPERTROPHIE": { sets: 3, reps: "8-12" }, // Volume
    "ENDURANCE": { sets: 3, reps: "15-20" }
};

// --- LISTE COMPLÈTE (Pour que la DB trouve les noms) ---
export const TEMPLATES = {}; // Laissé vide car géré par WIZARD_SPLITS maintenant