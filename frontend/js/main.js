// frontend/js/main.js (FINAL CORRECTED VERSION)

import { initState } from './state.js';
import { initUI, updateNavbar } from './ui.js';
import { initConversation } from './conversation.js';

// --- START: CORRECTED SECTION ---
// We must import all modules that need to run on startup.
// These modules will set up their own event listeners.
import './auth.js';
import './search.js';
import './wordbook.js';
// --- END: CORRECTED SECTION ---

import { checkAuth } from './auth.js';


/**
 * Main Application Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("App loading...");

    // 1. Initialize global state from localStorage
    initState();

    // 2. Check for an existing auth token in localStorage
    checkAuth();

    // 3. Cache all necessary DOM elements and setup general UI listeners
    initUI();

    // 4. Update the UI based on the initial authentication state
    updateNavbar();

    // 5. Initialize the core conversation functionality
    initConversation();

    console.log("App initialized successfully.");
});