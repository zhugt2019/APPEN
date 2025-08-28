// frontend/js/state.js

// A simple, shared state object for a portion of the application.
export const state = {
    // Auth state
    isLoggedIn: false,
    authToken: null,
    username: null,

    // Conversation-specific state
    currentLevel: 'A2',
    currentScenario: '',
    messages: [],
    isRecording: false,
    isLoading: false,

    // Target language for dynamic translations. Default to Chinese.
    targetLanguage: 'zh',
};

// Initializes state from localStorage.
export function initState() {
    const level = localStorage.getItem('appen_level');
    if (level) {
        state.currentLevel = level;
    }
    
    const savedLang = localStorage.getItem('targetLanguage');
    if (savedLang) {
        state.targetLanguage = savedLang;
    }

    console.log("Initial state loaded:", state);
}

// Function to update the auth state
export function setAuthState(isLoggedIn, token, username) {
    state.isLoggedIn = isLoggedIn;
    state.authToken = token;
    state.username = username;

    if (token) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('username', username);
    } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
    }
    console.log("Auth state updated:", state);
}