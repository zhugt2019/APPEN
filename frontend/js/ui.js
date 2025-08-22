// frontend/js/ui.js (FINAL with LAYOUT FIX)

import { state } from './state.js';
import { loadWordbook } from './wordbook.js';


export const elements = {};

function cacheElements() {
    elements.levelButtons = document.querySelectorAll('[data-action="select-level"]');
    elements.scenarioText = document.getElementById('scenarioText');
    elements.chatContainer = document.getElementById('chatContainer');
    elements.recordButton = document.getElementById('recordButton');
    elements.recordingInterface = document.getElementById('recordingInterface');
    elements.fabRecord = document.getElementById('fabRecord');
    elements.toast = document.getElementById('toast');
    elements.randomScenarioBtn = document.getElementById('randomScenarioBtn');
    elements.customScenarioBtn = document.getElementById('customScenarioBtn');
    elements.exampleDialogBtn = document.getElementById('exampleDialogBtn');
    elements.customScenarioModal = document.getElementById('customScenarioModal');
    elements.customScenarioInput = document.getElementById('customScenarioInput');
    elements.customScenarioGenerateBtn = document.getElementById('customScenarioGenerate');
    elements.customScenarioCancelBtn = document.getElementById('customScenarioCancel');
    elements.practiceSection = document.getElementById('practice-section'); 
    elements.searchSection = document.getElementById('search-section');
    elements.wordbookSection = document.getElementById('wordbook-section');
    elements.loginModal = document.getElementById('login-modal');
    elements.navLogin = document.getElementById('nav-login');
    elements.navLogout = document.getElementById('nav-logout');
    elements.navWordbook = document.getElementById('nav-wordbook');
    elements.navPractice = document.getElementById('nav-practice');
    elements.navSearch = document.getElementById('nav-search');
    elements.allNavLinks = document.querySelectorAll('.nav-link');
}

export function updateNavbar() {
    if (!elements.navLogin) return;
    if (state.isLoggedIn) {
        elements.navLogin.style.display = 'none';
        elements.navLogout.style.display = 'block';
        elements.navWordbook.style.display = 'block';
    } else {
        elements.navLogin.style.display = 'block';
        elements.navLogout.style.display = 'none';
        elements.navWordbook.style.display = 'none';
    }
}

let toastTimer;
export function showToast(message, duration = 3000) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), duration);
}

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

export function showView(viewName) {
    if (elements.practiceSection) elements.practiceSection.style.display = 'none';
    if (elements.searchSection) elements.searchSection.style.display = 'none';
    if (elements.wordbookSection) elements.wordbookSection.style.display = 'none';

    elements.allNavLinks.forEach(link => link.classList.remove('active'));

    if (viewName === 'practice' && elements.practiceSection) {
        elements.practiceSection.style.display = 'block';
        elements.navPractice.classList.add('active');
    } else if (viewName === 'search' && elements.searchSection) {
        elements.searchSection.style.display = 'block';
        elements.navSearch.classList.add('active');
    } else if (viewName === 'wordbook' && elements.wordbookSection) {
        elements.wordbookSection.style.display = 'block';
        elements.navWordbook.classList.add('active');
    }
}

export function initUI() {
    cacheElements();
    elements.levelButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.level === state.currentLevel));

    // All navigation event listeners are now centralized here for reliability.
    elements.navPractice.addEventListener('click', (e) => { e.preventDefault(); showView('practice'); });
    elements.navSearch.addEventListener('click', (e) => { e.preventDefault(); showView('search'); });
    // The listener for Wordbook now calls the imported loadWordbook function.
    elements.navWordbook.addEventListener('click', (e) => { e.preventDefault(); loadWordbook(); });
}

// --- LAYOUT FIX APPLIED HERE ---
export function renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    container.innerHTML = '';
    
    if (results === null) {
        container.innerHTML = `<p class="text-error">Error fetching results.</p>`;
        return;
    }
    if (results.length === 0) {
        container.innerHTML = `<p class="text-secondary">No results found.</p>`;
        return;
    }

    results.forEach(item => {
        const itemDiv = document.createElement('div');
        // This class is defined in main.css and provides flexbox layout
        itemDiv.className = 'result-item flex-between'; 
        
        let addButton = '';
        if (state.isLoggedIn) {
            addButton = `<button class="btn btn-sm btn-outline btn-add-wordbook" data-word="${item.swedish_word}" data-definition="${item.english_def}">Add</button>`;
        }

        itemDiv.innerHTML = `
            <div class="word-details">
                <h4>${item.swedish_word} <small>(${item.word_class || 'N/A'})</small></h4>
                <p>${item.english_def}</p>
            </div>
            ${addButton}
        `;
        container.appendChild(itemDiv);
    });
}

export function renderWordbookList(entries) {
    const container = document.getElementById('wordbookList');
    if (!container) return;
    container.innerHTML = '';

    if (entries === null) {
        container.innerHTML = `<p class="text-error">Error loading your wordbook.</p>`;
        return;
    }
    if (entries.length === 0) {
        container.innerHTML = `<p class="text-secondary">Your wordbook is empty. Add words from the search page!</p>`;
        return;
    }

    entries.forEach(item => {
        const itemDiv = document.createElement('div');
         // Using the same class for consistent layout
        itemDiv.className = 'wordbook-item flex-between';
        itemDiv.innerHTML = `
            <div class="word-details">
                <h4>${item.word}</h4>
                <p>${item.definition}</p>
            </div>
            <button class="btn btn-sm btn-error btn-remove-wordbook" data-id="${item.id}">Remove</button>
        `;
        container.appendChild(itemDiv);
    });
}