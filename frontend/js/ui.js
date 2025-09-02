// frontend/js/ui.js (FINAL with LAYOUT FIX)

import { state } from './state.js';
import { loadWordbook } from './wordbook.js';
import { loadInitialScenario } from './conversation.js';
import { api } from './api.js';
import { updateAuthModalUI, logout, setAuthMode } from './auth.js';

export const elements = {};

// --- ADD THIS ENTIRE BLOCK START ---

function cacheElements() {
    elements.levelButtons = document.querySelectorAll('[data-action="select-level"]');
    elements.scenarioText = document.getElementById('scenarioText');
    elements.chatContainer = document.getElementById('chatContainer');
    elements.recordButton = document.getElementById('recordButton');
    elements.recordingInterface = document.getElementById('recordingInterface');
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
    elements.menuToggleBtn = document.getElementById('menu-toggle-btn');
    elements.menuDropdown = document.getElementById('menu-dropdown');
    elements.languageSelectors = document.querySelectorAll('.language-selector');
}

// frontend/js/ui.js

// ... (文件顶部导入代码) ...

export function initUI() {
    cacheElements();

    // 导航事件监听器
    // 桌面端和移动端导航共享同一个事件处理函数
    const handleNavClick = (e) => {
        e.preventDefault();
        const navId = e.target.id;
        if (navId.includes('practice')) {
            showView('practice');
            loadInitialScenario();
        } else if (navId.includes('search')) {
            showView('search');
        } else if (navId.includes('wordbook')) {
            if (state.isLoggedIn) {
                loadWordbook();
            } else {
                showToast("Please log in to see your wordbook.");
            }
        } else if (navId.includes('login')) {
            setAuthMode(true); // <--- 使用新的函数来设置模式
            updateAuthModalUI();
            showModal('login-modal');
        } else if (navId.includes('logout')) {
            logout();
        }
    };
    
    // 为所有导航链接添加事件监听器
    if (elements.allNavLinks) {
        elements.allNavLinks.forEach(link => {
            link.addEventListener('click', handleNavClick);
        });
    }

    // 菜单切换按钮
    if (elements.menuToggleBtn && elements.menuDropdown) {
        elements.menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.menuDropdown.classList.toggle('active');
        });
        window.addEventListener('click', (e) => {
            if (elements.menuDropdown.classList.contains('active') && !elements.menuDropdown.contains(e.target) && !elements.menuToggleBtn.contains(e.target)) {
                elements.menuDropdown.classList.remove('active');
            }
        });
    }

    // 语言选择器
    if (elements.languageSelectors) {
        // 当任何一个选择器发生变化时
        const handleLanguageChange = (e) => {
            const newLang = e.target.value;
            
            // 1. 更新全局状态和本地存储
            state.targetLanguage = newLang;
            localStorage.setItem('targetLanguage', newLang);

            // 2. 同步所有其他选择器的值
            elements.languageSelectors.forEach(selector => {
                if (selector !== e.target) {
                    selector.value = newLang;
                }
            });

            // 3. 显示提示
            const selectedLanguageName = e.target.options[e.target.selectedIndex].text;
            showToast(`Translation language set to ${selectedLanguageName}`);
        };

        // 为所有选择器设置初始值并绑定事件
        elements.languageSelectors.forEach(selector => {
            selector.value = state.targetLanguage;
            selector.addEventListener('change', handleLanguageChange);
        });
    }
    
    // 搜索结果中的 AI 报告按钮
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.addEventListener('click', handleWordReportRequest);
    }
    
    // 统一更新登录/登出按钮的显示
    updateNavbar();
}

// --- ADD THIS ENTIRE BLOCK END ---

function highlight(text, term) {
    if (!term || !text) {
        return text;
    }
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong class="highlight">$1</strong>');
}

export function updateNavbar() {
    // 统一处理移动端和桌面端的登录/登出按钮
    const loginLinks = document.querySelectorAll('[id^="nav-login"]');
    const logoutLinks = document.querySelectorAll('[id^="nav-logout"]');
    const wordbookLinks = document.querySelectorAll('[id^="nav-wordbook"]');

    loginLinks.forEach(link => link.style.display = state.isLoggedIn ? 'none' : 'block');
    logoutLinks.forEach(link => link.style.display = state.isLoggedIn ? 'block' : 'none');
    wordbookLinks.forEach(link => link.style.display = state.isLoggedIn ? 'block' : 'none');
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

    // 统一为所有导航链接移除 active 类
    elements.allNavLinks.forEach(link => link.classList.remove('active'));

    const activeLinks = document.querySelectorAll(`[id^="nav-${viewName}"]`);
    activeLinks.forEach(link => link.classList.add('active'));

    if (viewName === 'practice' && elements.practiceSection) {
        elements.practiceSection.style.display = 'block';
    } else if (viewName === 'search' && elements.searchSection) {
        elements.searchSection.style.display = 'block';
    } else if (viewName === 'wordbook' && elements.wordbookSection) {
        elements.wordbookSection.style.display = 'block';
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
                            Explain in my language
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

