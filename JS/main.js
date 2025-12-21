import { initTheme, toggleTheme, renderTabs, toggleDetails, toggleAuthMode, updateHeaderGreeting, renderWorkout, showToast, updateProgressBar } from './ui.js';
import { initAuth, handleLogin, handleSignUp, handleLogout, handleSocialLogin } from './auth.js';
import { switchTab, finishSession, deleteSession, editSession, cancelEdit,addSet,removeSet,updateSet,updateNote,openDateEditor,saveDateChange } from './logic.js';
import { openSocialModal, handleUserSearch, refreshSocialUI, addFriend, acceptRequest, openFeedDetails, switchSocialTab, removeFriend } from './social_ui.js';
import { toggleTimer, resetTimer } from './utils.js';
import { openProfileModal, uploadAvatar } from './profile.js';
import { openOnboarding, applyTemplate, closeOnboardingAndBuild } from './onboarding.js';
import { openGeneratorModal, selectFrequency, confirmGeneration, selectGoal} from './generator.js';
import { openAnalytics, closeAnalytics } from './analytics.js';
import { handleVisionSearch } from './builder.js';

// Imports du Builder
import { 
    openBuilder, toggleBuilderSelection, filterBuilderList, saveNewProgram,
    openProgramManager, removeManagerItem, saveManagerChanges, deleteCustomProgram,
    openExerciseSelector, filterSelectorList, addExerciseToManager
} from './builder.js';

// --- RENDRE LES FONCTIONS ACCESSIBLES (WINDOW) ---

// Profil
window.openProfileModal = openProfileModal;
window.uploadAvatar = uploadAvatar;

// Social
window.openSocialModal = openSocialModal;
window.handleUserSearch = handleUserSearch;
window.refreshSocialUI = refreshSocialUI;
window.addFriend = addFriend;
window.acceptRequest = acceptRequest;
window.switchSocialTab = switchSocialTab;
window.openFeedDetails = openFeedDetails; 
window.removeFriend = removeFriend;

// UI & Thème
window.toggleTheme = toggleTheme;
window.toggleAuthMode = toggleAuthMode;
window.toggleDetails = toggleDetails;
window.renderTabs = renderTabs;
window.updateHeaderGreeting = updateHeaderGreeting;
window.updateProgressBar= updateProgressBar;

// Auth
window.handleLogin = handleLogin;
window.handleSignUp = handleSignUp;
window.handleSocialLogin = handleSocialLogin;
window.handleLogout = handleLogout;

// Logique Séance
window.switchTab = switchTab;
window.updateSet = updateSet;   
window.addSet = addSet;         
window.removeSet = removeSet;   
window.updateNote = updateNote;
window.finishSession = finishSession;
window.deleteSession = deleteSession;
window.editSession = editSession;
window.cancelEdit = cancelEdit;
window.openDateEditor = openDateEditor;
window.saveDateChange = saveDateChange;

window.openAnalytics = openAnalytics;
window.closeAnalytics = closeAnalytics;

window.handleVisionSearch = handleVisionSearch;

// Timer
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;

// Builder & Manager
window.openBuilder = openBuilder;
window.toggleBuilderSelection = toggleBuilderSelection;
window.filterBuilderList = filterBuilderList;
window.saveNewProgram = saveNewProgram;
window.openProgramManager = openProgramManager;
window.removeManagerItem = removeManagerItem;
window.saveManagerChanges = saveManagerChanges;
window.deleteCustomProgram = deleteCustomProgram;
window.openExerciseSelector = openExerciseSelector;
window.filterSelectorList = filterSelectorList;
window.addExerciseToManager = addExerciseToManager;

// Onboarding & Generator
window.openOnboarding = openOnboarding;
window.applyTemplate = applyTemplate;
window.closeOnboardingAndBuild = closeOnboardingAndBuild;
window.openGeneratorModal = openGeneratorModal;
window.selectFrequency = selectFrequency;
window.confirmGeneration = confirmGeneration;
window.selectGoal = selectGoal;
// --- DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔥 GymTracker Ultimate V3 démarré");
    try {
        initTheme();
        initAuth();
    } catch (e) {
        console.error("CRASH AU DÉMARRAGE :", e);
        alert("Erreur critique : Regarde la console.");
    }
});