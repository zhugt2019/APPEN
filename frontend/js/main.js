// frontend/js/main.js (FINAL CORRECTED VERSION)
import { initUI, updateNavbar, showView } from './ui.js';
import { initState } from './state.js';
import { checkAuth, initAuth } from './auth.js';
import { initConversation } from './conversation.js';

// Import these modules so their event listeners are set up.
// These modules handle their own initialization internally.
import './search.js';
import './wordbook.js';

/**
 * Main Application Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("App loading...");

    // 1. Initialize global state from localStorage
    initState();

    // 2. Check for an existing auth token in localStorage
    checkAuth();

    // 3. Cache DOM elements and set up general UI event listeners
    initUI();

    // 4. Set up authentication-specific event listeners (for login/logout buttons, etc.)
    initAuth();

    // 5. Update UI components like the navbar based on the initial auth state
    updateNavbar();

    // 6. Initialize the core conversation functionality
    initConversation();

    // Explicitly set the default view to 'search' ---
    showView('search'); 

    console.log("App initialized successfully.");
});