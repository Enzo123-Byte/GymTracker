import { supabase } from './supabase.js';
import { workouts } from './config.js';
import { currentUser, currentTab, setCurrentUser, setGlobalHistory, loadUserPrograms } from './state.js';
import { showToast } from './ui.js';

// --- SYNC HISTORIQUE ---
export async function syncHistoryFromCloud() {
    if (!currentUser) return;

    const dateEl = document.getElementById('current-date');
    
    // Indicateur discret de chargement
    if (dateEl && !dateEl.innerHTML.includes('🔄')) {
       // On ne touche pas au HTML s'il est déjà bon, pour éviter les sauts
    }

    const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (!error && data) {
        const formattedHistory = data.map(log => ({
            id: log.id,
            day: log.program_name,
            date: log.date,
            exercises: log.session_data,
            created_at: log.created_at
        }));
        
        setGlobalHistory(formattedHistory);
    }
}

// --- INIT AUTHENTIFICATION (Le correctif est ici) ---
export async function initAuth() {
    console.log("🔍 Démarrage Auth...");

    // 1. DÉTECTION RETOUR GOOGLE
    // On regarde si l'URL contient les paramètres typiques d'un retour OAuth
    const isRedirect = window.location.hash && (
        window.location.hash.includes('access_token') || 
        window.location.hash.includes('type=recovery')
    );

    if (isRedirect) {
        console.log("🔄 Retour Google détecté : On patiente...");
        // On ne fait RIEN ici (pas de modale). 
        // On laisse le listener 'onAuthStateChange' ci-dessous capturer la session quand elle sera prête.
    } else {
        // 2. COMPORTEMENT STANDARD (Pas de redirection)
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
            console.log("✅ Session trouvée au démarrage");
            handleSessionSuccess(data.session);
        } else {
            console.log("❌ Pas de session : Affichage modale");
            const modal = document.getElementById('auth-modal');
            if(modal) modal.classList.remove('hidden');
        }
    }

    // 3. ÉCOUTE PERMANENTE (C'est lui qui va attraper le login Google)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("⚡ Auth Event :", event);
        
        if (event === 'SIGNED_IN' && session) {
            console.log("🎉 Connecté via event !");
            handleSessionSuccess(session);
        } 
        else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setGlobalHistory([]);
            const modal = document.getElementById('auth-modal');
            if(modal) modal.classList.remove('hidden');
        }
    });
}

// --- GESTION SUCCÈS CONNEXION ---
// ... (Imports inchangés) ...

async function handleSessionSuccess(session) {
    setCurrentUser(session.user);
    document.getElementById('auth-modal').classList.add('hidden');
    
    // 1. GESTION HEADER (Prénom + Avatar)
    let displayName = session.user.email.split('@')[0];
    let avatarUrl = null;
    
    // On récupère le profil complet
    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', session.user.id)
        .single();

    if (profile) {
        if (profile.first_name) displayName = profile.first_name;
        if (profile.avatar_url) avatarUrl = profile.avatar_url;
    }

    // Mise à jour de l'affichage du header
    if (typeof window.updateHeaderGreeting === 'function') {
        window.updateHeaderGreeting(displayName, avatarUrl);
    }

    // 2. CHARGEMENT DES DONNÉES
    await syncHistoryFromCloud();
    await loadUserPrograms();
    
    // 3. NAVIGATION INTELLIGENTE
    const availablePrograms = Object.keys(workouts);
    let targetTab = localStorage.getItem('lastTab');

    // CAS A : Aucun programme (Nouveau compte ou tout supprimé)
    if (availablePrograms.length === 0) {
        // On demande juste à l'UI de s'afficher. 
        // Comme la liste est vide, renderTabs() va afficher l'écran d'accueil (#empty-state).
        if (typeof window.renderTabs === 'function') window.renderTabs();
        return; // ON ARRÊTE ICI (Pas de switchTab vers Historique)
    } 
    
    // CAS B : Des programmes existent
    else {
        // Vérification de sécurité : Si l'onglet sauvegardé n'existe plus (ex: programme supprimé)
        // et que ce n'est pas l'historique, on revient au premier programme disponible.
        if (!availablePrograms.includes(targetTab) && targetTab !== 'HISTORIQUE') {
            targetTab = availablePrograms[0];
        }

        // Si aucune préférence n'était sauvegardée
        if (!targetTab) targetTab = availablePrograms[0];

        // On affiche les onglets et on ouvre le bon
        if (typeof window.renderTabs === 'function') window.renderTabs();
        if (typeof window.switchTab === 'function') window.switchTab(targetTab);
    }
}
// ... (Reste du fichier inchangé) ...

// --- ACTIONS LOGIN ---
export async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('auth-error');

    if(!email || !password) return;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.innerText = "Erreur : " + error.message;
        errorMsg.classList.remove('hidden');
    } else {
        errorMsg.classList.add('hidden');
    }
}

// --- ACTIONS SIGNUP ---
export async function handleSignUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();

    const errorMsg = document.getElementById('auth-error');

    if(!email || !password || !confirmPassword || !firstName || !lastName) {
        errorMsg.innerText = "Remplis tout !";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (password !== confirmPassword) {
        errorMsg.innerText = "Mots de passe différents !";
        errorMsg.classList.remove('hidden');
        return;
    }

    const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName
            }
        }
    });

    if (error) {
        errorMsg.innerText = "Erreur : " + error.message;
        errorMsg.classList.remove('hidden');
    } else {
        alert("Compte créé !");
        if (typeof window.toggleAuthMode === 'function') window.toggleAuthMode();
    }
}

// --- CONNEXION SOCIALE (GOOGLE) ---
export async function handleSocialLogin(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        alert("Erreur connexion sociale : " + error.message);
    }
}

// --- LOGOUT ---
export async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}