import { getExerciseHistoryData } from './logic.js';
import { calculateTrendSlope } from './utils.js';
import { supabase } from './supabase.js';

let chartInstance = null;

// --- OUVERTURE ---
export async function openAnalytics(exerciseId, exerciseName) {
    const modal = document.getElementById('analytics-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('analytics-title').innerText = exerciseName;
    document.getElementById('analytics-diagnostic').classList.add('hidden');
    document.getElementById('analytics-suggestions').classList.add('hidden');

    // 1. Récupération des données
    const data = getExerciseHistoryData(exerciseId);

    // 2. Affichage Graphique
    renderChart(data);

    // 3. Analyse & Recommandations (Si assez de données)
    if (data.length >= 3) {
        analyzeProgression(data, exerciseId);
    }
}

export function closeAnalytics() {
    document.getElementById('analytics-modal').classList.add('hidden');
}

// --- GRAPHIQUE CHART.JS ---
function renderChart(dataPoints) {
    const ctx = document.getElementById('progressChart').getContext('2d');

    // Nettoyage de l'ancien graph
    if (chartInstance) chartInstance.destroy();

    const labels = dataPoints.map(d => d.x);
    const values = dataPoints.map(d => d.y);

    // Configuration Chart.js
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '1RM Estimé (kg)',
                data: values,
                borderColor: '#10b981', // Emerald-500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10b981',
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3, // Lissage courbe
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(200, 200, 200, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// --- INTELLIGENCE : DÉTECTION PLATEAU ---
async function analyzeProgression(data, currentExId) {
    // On prend les 5 dernières séances max pour la tendance récente
    const recentData = data.slice(-5);
    const values = recentData.map(d => d.y);
    
    // Calcul de la pente (Dérivée lissée)
    const slope = calculateTrendSlope(values);
    console.log("Pente de progression:", slope);

    // SEUILS DE DÉCISION
    // Si la pente est entre -0.5 et +0.5 kg par séance, on considère que c'est plat
    const IS_PLATEAU = slope > -0.5 && slope < 0.5;
    const IS_REGRESSION = slope <= -0.5;

    if (IS_PLATEAU || IS_REGRESSION) {
        // AFFICHER L'ALERTE
        const diagBox = document.getElementById('analytics-diagnostic');
        const title = diagBox.querySelector('h4');
        const desc = diagBox.querySelector('p');

        diagBox.classList.remove('hidden');
        
        if (IS_REGRESSION) {
            title.innerText = "Régression Détectée 📉";
            title.className = "font-bold text-red-500 text-sm";
            desc.innerText = "Tes performances baissent. Fatigue accumulée ?";
        } else {
            title.innerText = "Plateau Détecté 😐";
            title.className = "font-bold text-orange-500 text-sm";
            desc.innerText = "Progression stoppée récemment. Change d'exercice !";
        }

        // LANCER LES RECOMMANDATIONS
        await suggestAlternatives(currentExId);
    }
}

// --- RECOMMANDATION MVP (Basée sur Catégorie) ---
async function suggestAlternatives(currentId) {
    // 1. Récupérer l'info de l'exo actuel (pour avoir sa catégorie)
    const { data: currentEx } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', currentId)
        .single();

    if (!currentEx) return;

    // 2. Chercher des exos de la MEME catégorie, mais différents
    const { data: alternatives } = await supabase
        .from('exercises')
        .select('*')
        .eq('category', currentEx.category) // On utilise la catégorie existante
        .neq('id', currentId) // Pas le même exo
        .limit(10); // On en prend un paquet pour mélanger

    if (!alternatives || alternatives.length === 0) return;

    // 3. Mélanger et prendre 2 au hasard
    const shuffled = alternatives.sort(() => 0.5 - Math.random()).slice(0, 2);

    // 4. Afficher
    const container = document.getElementById('analytics-suggestions');
    const list = document.getElementById('suggestions-list');
    container.classList.remove('hidden');
    
    list.innerHTML = shuffled.map(ex => `
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 shadow-sm hover:border-emerald-500 cursor-pointer transition-colors" onclick="alert('Tu peux ajouter ${ex.name} via le Builder !')">
            <div class="w-10 h-10 bg-white rounded p-1 border border-slate-100 flex-shrink-0">
                <img src="${ex.img_url}" class="w-full h-full object-contain">
            </div>
            <div>
                <div class="font-bold text-sm text-slate-800 dark:text-white">${ex.name}</div>
                <div class="text-[10px] text-emerald-500 font-bold uppercase">Même groupe : ${ex.category}</div>
            </div>
        </div>
    `).join('');
}