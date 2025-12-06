import { supabase } from './supabase.js';
import { workouts } from './config.js';

// --- ÉTAT GLOBAL (VARIABLES) ---
export let currentUser = null;
export let globalHistory = [];
export let currentTab = localStorage.getItem('lastTab') || "PUSH";

// --- GETTERS & SETTERS (C'est ici qu'il manquait getHistory) ---

// 👇 LA CORRECTION EST ICI 👇
export const getHistory = () => globalHistory; 
// 👆 --------------------- 👆

export function setCurrentUser(user) { currentUser = user; }
export function setGlobalHistory(hist) { globalHistory = hist; }
export function setCurrentTab(tab) { 
    currentTab = tab; 
    localStorage.setItem('lastTab', tab);
}

// --- LOCAL STORAGE HELPERS ---
export const getActiveSession = () => JSON.parse(localStorage.getItem('activeSession')) || {};

export const saveActiveSession = (data) => {
    localStorage.setItem('activeSession', JSON.stringify(data));
};

export const getEditSessionId = () => localStorage.getItem('editingSessionId');
export const setEditSessionId = (id) => localStorage.setItem('editingSessionId', id);
export const clearEditSessionId = () => localStorage.removeItem('editingSessionId');

// --- CHARGEMENT DONNÉES ---
export async function loadUserPrograms() {
    if (!currentUser) return;

    const { data: programs } = await supabase.from('user_programs').select('*').eq('user_id', currentUser.id);
    
    // On charge les exercices AVEC leurs valeurs par défaut
    const { data: dbExercises } = await supabase.from('exercises').select('*');
    
    if (programs && programs.length > 0 && dbExercises) {
        programs.forEach(prog => {
            const progExercises = prog.exercises.map(item => {
                const exId = typeof item === 'string' ? item : item.id;
                
                // 1. On trouve l'exo dans la DB
                const dbEx = dbExercises.find(e => e.id === exId);
                if (!dbEx) return null;

                // 2. On décide des valeurs (User Custom > Valeur par défaut de la DB)
                const customSets = (typeof item === 'object' && item.sets) ? item.sets : (dbEx.default_sets || 3);
                const customReps = (typeof item === 'object' && item.reps) ? item.reps : (dbEx.default_reps || "10-12");
                const notes = dbEx.notes || ""; 

                return {
                    id: dbEx.id,
                    name: dbEx.name,
                    sets: customSets,
                    reps: customReps,
                    notes: notes,
                    img: dbEx.img_url 
                };
            }).filter(e => e !== null);

            workouts[prog.name] = progExercises;
        });
    }
}