// frontend/js/auth.js (FINAL CORRECTED VERSION)

import { state, setAuthState } from './state.js';
import { updateNavbar, showToast, closeModal, showModal, elements, showView } from './ui.js';
import { API } from './api.js';

const api = new API();
let isLoginMode = true;

// This function sets up all event listeners related to authentication.
function setupAuthEventListeners() {
    // It's possible for elements to not be cached yet if this runs too early.
    // We ensure elements are available before adding listeners.
    if (!elements.navLogin) {
        // If elements aren't ready, wait a moment and try again.
        setTimeout(setupAuthEventListeners, 50);
        return;
    }

    const form = document.getElementById('auth-form');
    const switchModeBtn = document.getElementById('auth-mode-switch');
    
    if (form) form.addEventListener('submit', handleAuthSubmit);
    if (switchModeBtn) switchModeBtn.addEventListener('click', toggleAuthMode);

    elements.navLogin.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = true;
        updateAuthModalUI();
        showModal('login-modal');
    });

    elements.navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

function updateAuthModalUI() {
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchBtn = document.getElementById('auth-mode-switch');
    const errorMsg = document.getElementById('error-message');

    if (errorMsg) errorMsg.style.display = 'none';

    if (isLoginMode) {
        if (title) title.textContent = 'Login';
        if (submitBtn) submitBtn.textContent = 'Login';
        if (switchBtn) switchBtn.textContent = 'Need an account? Register';
    } else {
        if (title) title.textContent = 'Register';
        if (submitBtn) submitBtn.textContent = 'Register';
        if (switchBtn) switchBtn.textContent = 'Have an account? Login';
    }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthModalUI();
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-message');
    const submitBtn = document.getElementById('auth-submit-btn');

    const username = usernameInput.value;
    const password = passwordInput.value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    errorMsg.style.display = 'none';

    try {
        if (isLoginMode) {
            const data = await api.login(username, password);
            setAuthState(true, data.access_token, username);
            showToast(`Welcome back, ${username}!`);
        } else {
            await api.register(username, password);
            showToast('Registration successful! Please log in.');
            toggleAuthMode();
        }
        if (state.isLoggedIn) {
            closeModal('login-modal');
            event.target.reset();
        }
    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        // update the button text based on the current mode
        if (isLoginMode) {
            submitBtn.textContent = 'Login';
        } else {
            submitBtn.textContent = 'Register';
        }
    }
    updateNavbar();
}

export function checkAuth() {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    if (token && username) {
        setAuthState(true, token, username);
    }
}

export function logout() {
    setAuthState(false, null, null);
    updateNavbar();
    showToast("You have been logged out.");
    showView('practice');
}

// This ensures event listeners are set up after the main UI script has cached the elements.
// document.addEventListener('DOMContentLoaded', setupAuthEventListeners);

export function initAuth() {
    setupAuthEventListeners();
}