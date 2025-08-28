// frontend/js/ui.js (FINAL with LAYOUT FIX)

import { state } from './state.js';
import { loadWordbook } from './wordbook.js';
import { loadInitialScenario } from './conversation.js';
import { api } from './api.js'; // <--- 添加这个导入

export const elements = {};

// --- ADD THIS ENTIRE BLOCK START ---

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
    // ADD THESE TWO LINES AT THE END OF THE FUNCTION
    elements.menuToggleBtn = document.getElementById('menu-toggle-btn');
    elements.menuDropdown = document.getElementById('menu-dropdown');
    
    // This line was for the language selector, it's safe to keep it here for when you add it.
    elements.languageSelector = document.getElementById('languageSelector'); 
}

export function initUI() {
    cacheElements();
    elements.levelButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.level === state.currentLevel));

    // --- ADD THIS ENTIRE BLOCK START ---
    // Event listener for the new menu toggle button
    if (elements.menuToggleBtn && elements.menuDropdown) {
        elements.menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents the window click listener from firing immediately
            elements.menuDropdown.classList.toggle('active');
        });

        // Add a listener to the whole window to close the menu when clicking outside
        window.addEventListener('click', (e) => {
            if (elements.menuDropdown.classList.contains('active') && !elements.menuDropdown.contains(e.target)) {
                elements.menuDropdown.classList.remove('active');
            }
        });
    }
    // --- ADD THIS ENTIRE BLOCK END ---

    // Event listener for language selector (will work when you add the HTML)
    if (elements.languageSelector) {
        elements.languageSelector.value = state.targetLanguage;
        elements.languageSelector.addEventListener('change', (e) => {
            const newLang = e.target.value;
            state.targetLanguage = newLang;
            localStorage.setItem('targetLanguage', newLang);
            const selectedLanguageName = e.target.options[e.target.selectedIndex].text;
            showToast(`Translation language set to ${selectedLanguageName}`);
        });
    }

    // Navigation event listeners
    elements.navPractice.addEventListener('click', (e) => {
        e.preventDefault();
        showView('practice');
        loadInitialScenario(); // Load scenario when switching to practice view
    });
    elements.navSearch.addEventListener('click', (e) => {
        e.preventDefault();
        showView('search');
    });
    elements.navWordbook.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.isLoggedIn) {
            loadWordbook();
        } else {
            showToast("Please log in to see your wordbook.");
        }
    });

    // Delegated event listener for AI report requests
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.addEventListener('click', handleWordReportRequest);
    }
}

// --- ADD THIS ENTIRE BLOCK END ---

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

// --- 在 ui.js 文件中新增一个翻译映射对象 ---
const reportLabels = {
    'zh': {
        definition: '定义',
        partOfSpeech: '词性',
        inflections: '变位/变格',
        exampleSentences: '例句',
        synonyms: '近义词',
        antonyms: '反义词'
    },
    'ko': {
        definition: '정의',
        partOfSpeech: '품사',
        inflections: '변형',
        exampleSentences: '예문',
        synonyms: '유의어',
        antonyms: '반의어'
    },
    'ur': { // 乌尔都语，请确认翻译是否准确
        definition: 'تعریف',
        partOfSpeech: 'صرف',
        inflections: 'صرفیاتی تبدیلیاں',
        exampleSentences: 'مثالی جملے',
        synonyms: 'مترادفات',
        antonyms: 'متضاد الفاظ'
    },
    'hi': { // 印地语，请确认翻译是否准确
        definition: 'परिभाषा',
        partOfSpeech: 'शब्द-भेद',
        inflections: 'रूप परिवर्तन',
        exampleSentences: 'उदाहरण वाक्य',
        synonyms: 'पर्यायवाची',
        antonyms: 'विलोम शब्द'
    },
    'uk': { // 乌克兰语，请确认翻译是否准确
        definition: 'Визначення',
        partOfSpeech: 'Частина мови',
        inflections: 'Відмінювання/Дієвідмінювання',
        exampleSentences: 'Приклади речень',
        synonyms: 'Синоніми',
        antonyms: 'Антоніми'
    },
    // Fallback or English if target language not found
    'default': {
        definition: 'Definition',
        partOfSpeech: 'Part of Speech',
        inflections: 'Inflections',
        exampleSentences: 'Example Sentences',
        synonyms: 'Synonyms',
        antonyms: 'Antonyms'
    }
};

// --- REVISED function with safety fallback ---
async function handleWordReportRequest(event) {
    const reportBtn = event.target.closest('.btn-get-report');
    if (!reportBtn) return;

    if (!state.isLoggedIn) {
        showToast("Please log in to use the AI analysis feature.");
        return;
    }

    const word = reportBtn.dataset.word;
    const wordClass = reportBtn.dataset.class;
    const id = reportBtn.dataset.id;
    const container = document.getElementById(`report-container-${id}`);

    if (!container) return;

    if (container.innerHTML !== '' && container.style.display !== 'none') {
        container.style.display = 'none';
        reportBtn.classList.remove('active');
        return;
    } else if (container.innerHTML !== '') {
        container.style.display = 'block';
        reportBtn.classList.add('active');
        return;
    }
    
    reportBtn.disabled = true;
    reportBtn.classList.add('active');
    container.style.display = 'block';
    container.innerHTML = `<div class="p-2 flex-center gap-2"><span class="spinner"></span><span class="text-secondary">Generating AI report...</span></div>`;

    try {
        // --- CORE FIX: Add a fallback to ensure targetLanguage is never undefined ---
        const targetLang = state.targetLanguage || 'zh'; // If state.targetLanguage is faulty, default to 'zh'
        
        console.log(`Sending report request for "${word}" with language: "${targetLang}"`);

        const report = await api.getWordReport(word, wordClass, targetLang); // Use the safe variable
        
        // --- 获取对应语言的标签 ---
        const labels = reportLabels[targetLang] || reportLabels['default'];
        
        container.innerHTML = `
            <div class="word-report">
                <p><strong>${labels.definition}:</strong> ${report.definition}</p>
                <p><strong>${labels.partOfSpeech}:</strong> ${report.part_of_speech}</p>
                <p><strong>${labels.inflections}:</strong> ${report.inflections}</p>
                
                <h4>${labels.exampleSentences}:</h4>
                <ul>
                    ${report.example_sentences.map(s => `<li>${s}</li>`).join('')}
                </ul>
                
                ${report.synonyms && report.synonyms.length > 0 ? `
                    <h4>${labels.synonyms}:</h4>
                    <p>${report.synonyms.join(', ')}</p>
                ` : ''}
                
                ${report.antonyms && report.antonyms.length > 0 ? `
                    <h4>${labels.antonyms}:</h4>
                    <p>${report.antonyms.join(', ')}</p>
                ` : ''}
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="p-2 text-error">Failed to generate report. Details: ${error.message}</div>`;
        console.error("Word report error:", error);
    } finally {
        reportBtn.disabled = false;
    }
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
            
            // --- NEW: Logic to build detailed HTML sections ---
            let definitionHTML = '';
            if (item.swedish_definition || item.swedish_explanation) {
                definitionHTML += `<div class="result-details"><h4>Definition & Explanation</h4>`;
                if (item.swedish_definition) {
                    definitionHTML += `<div class="detail-block"><p class="detail-sv">${highlight(item.swedish_definition, query)}</p>${item.english_definition ? `<p class="detail-en">${highlight(item.english_definition, query)}</p>` : ''}</div>`;
                }
                const isExplanationDifferent = item.swedish_explanation && (item.swedish_explanation !== item.swedish_definition);
                if (isExplanationDifferent) {
                    definitionHTML += `<div class="detail-block"><p class="detail-sv">${highlight(item.swedish_explanation, query)}</p>${item.english_explanation ? `<p class="detail-en">${highlight(item.english_explanation, query)}</p>` : ''}</div>`;
                }
                definitionHTML += `</div>`;
            }

            let examplesHTML = '';
            if (item.examples && item.examples.length > 0) {
                examplesHTML = '<div class="result-details"><h4>Examples</h4>';
                item.examples.slice(0, 3).forEach(ex => { // Show up to 3 examples
                    examplesHTML += `<div class="example"><p class="example-sv">”${highlight(ex.swedish_sentence, query)}”</p><p class="example-en">”${highlight(ex.english_sentence, query)}”</p></div>`;
                });
                examplesHTML += '</div>';
            }
            
            let idiomsHTML = '';
            if (item.idioms && item.idioms.length > 0) {
                idiomsHTML = '<div class="result-details"><h4>Related Idioms</h4>';
                item.idioms.forEach(idiom => {
                    idiomsHTML += `<div class="idiom"><p class="idiom-sv">”${highlight(idiom.swedish_idiom, query)}”</p><p class="idiom-en">”${highlight(idiom.english_idiom, query)}”</p></div>`;
                });
                idiomsHTML += '</div>';
            }

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

            const buttonText = (reportLabels[state.targetLanguage] || reportLabels['default']).buttonText || 'Explain in my language';

            // --- REVISED: Complete innerHTML with all sections ---
            itemDiv.innerHTML = `
                <div class="result-item-header flex-between">
                    <div class="word-details">
                        <h2>
                            <span class="word-text">${highlight(item.swedish_word, query)}</span>
                            <span class="badge">${item.word_class || 'N/A'}</span>
                        </h2>
                        <p class="translation-def">${highlight(item.english_def, query)}</p>
                    </div>
                    ${addButton}
                </div>
                ${definitionHTML}
                ${examplesHTML}
                ${idiomsHTML}
                ${advancedHTML}
                <div class="report-controls mt-2">
                    <button class="btn btn-sm btn-primary btn-get-report" 
                            data-word="${item.swedish_word}" 
                            data-class="${item.word_class || 'Unknown'}" 
                            data-id="${item.id}">
                        ${buttonText}
                    </button>
                </div>
                <div class="word-report-container" id="report-container-${item.id}"></div>
            `;
            container.appendChild(itemDiv);
        });
    }

    // Render "Found in Examples" (unchanged)
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
    
    // Style injection (unchanged)
    if (!document.getElementById('custom-details-style')) {
        const style = document.createElement('style');
        style.id = 'custom-details-style';
        style.innerHTML = `
            .result-item h2 { font-size: var(--font-size-2xl); margin-bottom: var(--spacing-xs); display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
            .result-item .badge { font-size: var(--font-size-xs); background-color: var(--secondary-color); color: var(--text-primary); padding: 4px 8px; border-radius: var(--border-radius-pill); font-weight: 600; white-space: nowrap; }

            /* --- ADDED THIS LINE TO HIDE THE ICON --- */
            .result-item .search-direction { display: none; } 

            .result-item .search-direction { font-size: var(--font-size-sm); font-weight: normal; }
            .result-item .translation-def { font-size: var(--font-size-lg); color: var(--text-primary); font-weight: 600; margin: 0; }
            .result-details { margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color); }
            .result-details h4 { font-size: var(--font-size-base); color: var(--primary-color); margin-bottom: var(--spacing-sm); }
            .detail-sv, .example-sv, .idiom-sv { color: var(--text-primary); font-style: italic; }
            .detail-en, .example-en, .idiom-en { color: var(--text-secondary); font-size: var(--font-size-sm); font-style: italic; }
            .advanced-details { margin-top: var(--spacing-md); }
            .advanced-details summary { cursor: pointer; font-weight: 500; color: var(--primary-color); }
            /* --- FINAL FIX: Removed horizontal padding --- */
            .highlight { 
                background-color: var(--secondary-color); 
                color: var(--text-primary); 
                border-radius: 3px; 
                padding: 0; /* Changed from '0 2px' to '0' */
            }
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

