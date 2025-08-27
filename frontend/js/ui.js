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

// --- ADD a helper function for highlighting at the top of the file or inside renderSearchResults ---
function highlight(text, term) {
    if (!term || !text) {
        return text;
    }
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong class="highlight">$1</strong>');
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

// --- MODIFIED RENDER FUNCTION ---
export function renderSearchResults(data, append = false, query = '') {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!append) {
        container.innerHTML = '';
    }

    if (data === null) {
        container.innerHTML = `<p class="text-error">Error fetching results.</p>`;
        return;
    }
    
    if (!append && !data.items.length && !data.examples_found.length) {
        container.innerHTML = `<p class="text-secondary">No results found for "${query}".</p>`;
        return;
    }

    if (data.items && data.items.length > 0) {
        if (!append) {
             container.innerHTML += `<h3>Dictionary Entries</h3>`;
        }
        data.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'result-item';
            
            let addButton = '';
            if (state.isLoggedIn) {
                addButton = `<button class="btn btn-sm btn-outline btn-add-wordbook" data-word="${item.swedish_word}" data-definition="${item.english_def}">Add</button>`;
            }
            
            // Section: Definitions and Explanations
            let definitionHTML = '';
            if (item.swedish_definition || item.swedish_explanation) {
                definitionHTML += `<div class="result-details"><h4>Definition & Explanation</h4>`;
                
                // Render Swedish Definition if it exists
                if (item.swedish_definition) {
                    definitionHTML += `<div class="detail-block"><p class="detail-sv">${highlight(item.swedish_definition, query)}</p>${item.english_definition ? `<p class="detail-en">${highlight(item.english_definition, query)}</p>` : ''}</div>`;
                }

                // --- FIXED [Problem 1]: Only render explanation if it's different from the definition ---
                const isExplanationDifferent = item.swedish_explanation && (item.swedish_explanation !== item.swedish_definition);
                if (isExplanationDifferent) {
                    definitionHTML += `<div class="detail-block"><p class="detail-sv">${highlight(item.swedish_explanation, query)}</p>${item.english_explanation ? `<p class="detail-en">${highlight(item.english_explanation, query)}</p>` : ''}</div>`;
                }
                definitionHTML += `</div>`;
            }

            // Section: Examples
            let examplesHTML = '';
            if (item.examples && item.examples.length > 0) {
                examplesHTML = '<div class="result-details"><h4>Examples</h4>';
                item.examples.forEach(ex => {
                    examplesHTML += `<div class="example"><p class="example-sv">”${ex.swedish_sentence}”</p><p class="example-en">”${ex.english_sentence}”</p></div>`;
                });
                examplesHTML += '</div>';
            }
            
            // Section: Idioms
            let idiomsHTML = '';
            if (item.idioms && item.idioms.length > 0) {
                idiomsHTML = '<div class="result-details"><h4>Related Idioms</h4>';
                item.idioms.forEach(idiom => {
                    idiomsHTML += `<div class="idiom"><p class="idiom-sv">”${idiom.swedish_idiom}”</p><p class="idiom-en">”${idiom.english_idiom}”</p></div>`;
                });
                idiomsHTML += '</div>';
            }

            // Section: Advanced (collapsible)
            let advancedHTML = '';
            if (item.grammar_notes || item.antonyms) {
                advancedHTML += `<details class="advanced-details"><summary>Grammar & Related Words</summary>`;
                if (item.grammar_notes) {
                    advancedHTML += `<div class="result-details"><h4>Grammar</h4><p class="detail-sv">${item.grammar_notes.replace(/\n/g, '<br>')}</p></div>`;
                }
                if (item.antonyms) {
                    advancedHTML += `<div class="result-details"><h4>Antonyms</h4><p class="detail-sv">${item.antonyms}</p></div>`;
                }
                advancedHTML += `</details>`;
            }

            const isSwedishSearch = item.swedish_word.toLowerCase().includes(query.toLowerCase()) || 
                                    (item.swedish_lemma && item.swedish_lemma.includes(query.toLowerCase()));

            // --- FIXED [Problem 3]: Moved search direction icon into H2 tag ---
            itemDiv.innerHTML = `
                <div class="result-item-header flex-between">
                    <div class="word-details">
                        <h2>
                            ${highlight(item.swedish_word, query)} 
                            <span class="badge">${item.word_class || 'N/A'}</span>
                            <span class="text-secondary search-direction">${isSwedishSearch ? '🇸🇪→🇬🇧' : '🇬🇧→🇸🇪'}</span>
                        </h2>
                        <p class="translation-def">${highlight(item.english_def, query)}</p>
                    </div>
                    ${addButton}
                </div>
                ${definitionHTML}
                ${examplesHTML}
                ${idiomsHTML}
                ${advancedHTML}
            `;
            container.appendChild(itemDiv);
        });
    }

    // Render results found in examples (this part remains the same)
    if (!append && data.examples_found && data.examples_found.length > 0) {
        let examplesSectionHTML = `<h3>Found in Examples</h3>`;
        data.examples_found.forEach(ex => {
            examplesSectionHTML += `
                <div class="result-item">
                    <div class="word-details">
                        <p class="example-sv">”${highlight(ex.swedish_sentence, query)}”</p>
                        <p class="example-en">”${highlight(ex.english_sentence, query)}”</p>
                        <p class="text-secondary mt-2">From word: <strong>${ex.parent_word}</strong></p>
                    </div>
                </div>
            `;
        });
        container.innerHTML += examplesSectionHTML;
    }
    
    // Inject styles if they don't exist
    if (!document.getElementById('custom-details-style')) {
        const style = document.createElement('style');
        style.id = 'custom-details-style';
        // --- FIXED [Problem 2]: Combined .example-en and .idiom-en selectors ---
        style.innerHTML = `
            .result-item h2 { font-size: var(--font-size-2xl); margin-bottom: var(--spacing-xs); display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
            .result-item .badge { font-size: var(--font-size-xs); background-color: var(--secondary-color); color: var(--text-primary); padding: 4px 8px; border-radius: var(--border-radius-pill); font-weight: 600; white-space: nowrap; }
            .result-item .search-direction { font-size: var(--font-size-sm); font-weight: normal; }
            .result-item .translation-def { font-size: var(--font-size-lg); color: var(--text-primary); font-weight: 600; margin: 0; }
            .result-details { margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color); }
            .result-details h4 { font-size: var(--font-size-base); color: var(--primary-color); margin-bottom: var(--spacing-sm); }
            .detail-sv, .example-sv, .idiom-sv { color: var(--text-primary); font-style: italic; }
            .detail-en, .example-en, .idiom-en { color: var(--text-secondary); font-size: var(--font-size-sm); font-style: italic; }
            .advanced-details { margin-top: var(--spacing-md); }
            .advanced-details summary { cursor: pointer; font-weight: 500; color: var(--primary-color); }
        `;
        document.head.appendChild(style);
    }
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