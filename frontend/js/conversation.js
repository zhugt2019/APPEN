// frontend/js/conversation.js (FINAL version with Practice Mode restored)

import { state } from './state.js';
import { elements, showToast, showModal, closeModal } from './ui.js';
import { API } from './api.js';
import { AudioRecorder } from './recorder.js';
import { Utils } from './utils.js';
// We need to import the ConversationPractice class for the modal button
import { ConversationPractice } from './conversation-practice.js';

let api;
let recorder;
// This variable will track if the initial scenario has been loaded.
let isInitialScenarioLoaded = false;

// --- THIS IS THE NEW FUNCTION ---
export async function loadInitialScenario() {
    // Only load the scenario if it hasn't been loaded before.
    if (!isInitialScenarioLoaded) {
        await generateNewScenario('random');
        isInitialScenarioLoaded = true;
    }
}

// --- THIS FUNCTION IS MODIFIED ---
export async function initConversation() {
    api = new API();
    recorder = new AudioRecorder({
        onStop: handleRecordingStop,
        onError: (err) => showToast(err.message || 'Recording failed.')
    });
    setupEventListeners();
    // REMOVED: The following line is now gone from here.
    // await generateNewScenario('random'); 
}

function setupEventListeners() {
    elements.levelButtons.forEach(btn => btn.addEventListener('click', () => selectLevel(btn.dataset.level)));
    elements.randomScenarioBtn.addEventListener('click', () => generateNewScenario('random'));
    elements.customScenarioBtn.addEventListener('click', showCustomScenarioModal);
    elements.customScenarioGenerateBtn.addEventListener('click', generateCustomScenario);
    elements.customScenarioCancelBtn.addEventListener('click', () => closeModal('customScenarioModal'));
    elements.recordButton.addEventListener('mousedown', startRecording);
    elements.recordButton.addEventListener('mouseup', stopRecording);
    elements.recordButton.addEventListener('mouseleave', stopRecording);
    elements.recordButton.addEventListener('touchstart', startRecording, { passive: false });
    elements.recordButton.addEventListener('touchend', stopRecording);
    
    if (elements.exampleDialogBtn) {
        elements.exampleDialogBtn.addEventListener('click', showExampleDialog);
    }
}

function selectLevel(level) {
    state.currentLevel = level;
    localStorage.setItem('appen_level', level);
    elements.levelButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.level === level));
    showToast(`Level changed to ${level}`);
}

async function generateNewScenario(type, customText = null) {
    if (state.isLoading) return;
    state.isLoading = true;
    elements.scenarioText.textContent = "Generating new scenario...";
    try {
        const options = { level: state.currentLevel };
        if (type === 'custom' && customText) {
            options.situation = customText;
        }
        const data = await api.generateScenario(type, options);
        state.currentScenario = data.scenario;
        elements.scenarioText.textContent = data.scenario;
        elements.chatContainer.innerHTML = '';
        state.messages = [];
    } catch (error) {
        console.error("Failed to generate scenario:", error);
        elements.scenarioText.textContent = "Failed to load a scenario. Please try again.";
        showToast(error.message);
    } finally {
        state.isLoading = false;
    }
}

function showCustomScenarioModal() {
    if (elements.customScenarioInput) elements.customScenarioInput.value = '';
    showModal('customScenarioModal');
    setTimeout(() => elements.customScenarioInput?.focus(), 100);
}

function generateCustomScenario() {
    const inputText = elements.customScenarioInput.value.trim();
    if (!inputText || inputText.length < 3) {
        showToast('Situation description is too short.');
        return;
    }
    closeModal('customScenarioModal');
    generateNewScenario('custom', inputText);
}

function showRecordingInterface() {
    elements.recordingInterface.classList.add('active');
    Utils.vibrate(50);
}

async function startRecording(e) {
    e.preventDefault();
    if (state.isLoading) return;
    try {
        await recorder.init();
        recorder.start();
        elements.recordButton.classList.add('recording');
    } catch (error) {
        showToast(error.message);
    }
}

function stopRecording() {
    if (recorder && recorder.isRecording) {
        recorder.stop();
        elements.recordButton.classList.remove('recording');
        setTimeout(() => elements.recordingInterface.classList.remove('active'), 500);
    }
}

function handleRecordingStop(audioBlob) {
    if (audioBlob.size < 1000) {
        showToast("Recording too short.");
        return;
    }
    processNewMessage(audioBlob);
}

async function processNewMessage(audioBlob) {
    if (state.isLoading) return;
    state.isLoading = true;
    const userMessageElem = addMessage('user', '...');
    userMessageElem.classList.add('loading');
    try {
        const transcriptionData = await api.transcribeAudio(audioBlob);
        const userText = transcriptionData.transcription;
        if (!userText || !userText.trim()) {
            userMessageElem.remove();
            throw new Error("Sorry, I didn't catch that. Please try again.");
        }
        updateMessage(userMessageElem, userText);
        userMessageElem.classList.remove('loading');
        state.messages.push({ role: 'user', content: userText });
        const aiMessageElem = addMessage('ai', '...');
        aiMessageElem.classList.add('loading');
        const aiResponseData = await api.getAiResponse({
            text: userText,
            history: state.messages,
            scenario: state.currentScenario,
            level: state.currentLevel
        });
        updateMessage(aiMessageElem, aiResponseData.response, aiResponseData.audioUrl);
        aiMessageElem.classList.remove('loading');
        state.messages.push({ role: 'ai', content: aiResponseData.response });
    } catch(error) {
        showToast(error.message);
        userMessageElem.remove();
    } finally {
        state.isLoading = false;
    }
}

function addMessage(role, text) {
    const messageElem = document.createElement('div');
    messageElem.className = `message ${role}`;
    messageElem.innerHTML = `
        <div class="message-avatar">${role === 'user' ? 'U' : 'AI'}</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${text}</div>
            </div>
        </div>
    `;
    if (role === 'user') {
        messageElem.insertBefore(messageElem.querySelector('.message-content'), messageElem.querySelector('.message-avatar'));
    }
    elements.chatContainer.appendChild(messageElem);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    return messageElem;
}

function updateMessage(messageElem, text, audioUrl = null) {
    const textElem = messageElem.querySelector('.message-text');
    textElem.textContent = text;
    if (audioUrl) {
        const bubble = messageElem.querySelector('.message-bubble');
        const audio = document.createElement('audio');
        audio.src = audioUrl;
        audio.controls = true;
        audio.className = 'audio-player';
        bubble.appendChild(audio);
    }
}

async function showExampleDialog() {
    if (elements.exampleDialogBtn.disabled) return;
    
    elements.exampleDialogBtn.disabled = true;
    const buttonSpan = elements.exampleDialogBtn.querySelector('span');
    if(buttonSpan) buttonSpan.textContent = 'Loading...';

    try {
        const data = await api.getExampleDialogue(state.currentLevel, state.currentScenario);
        createExampleModal(data);
    } catch (error) {
        console.error("Failed to load example dialogue:", error);
        showToast(error.message);
    } finally {
        elements.exampleDialogBtn.disabled = false;
        if(buttonSpan) buttonSpan.textContent = 'View Example Dialogue';
    }
}

// --- THIS FUNCTION IS NOW FULLY RESTORED ---
function createExampleModal(data) {
    const existingModal = document.getElementById('exampleModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'exampleModal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal';
    
    const formattedDialog = data.dialog.replace(/\n/g, '<br>');

    modalContent.innerHTML = `
        <h2>Example Dialogue (${data.level})</h2>
        <div class="example-dialog-content" style="white-space: pre-wrap; background: var(--background); padding: 10px; border-radius: 8px; margin: 15px 0; max-height: 40vh; overflow-y: auto;">
            ${formattedDialog}
        </div>
        <div class="modal-actions">
            <button id="closeExampleModalBtn" class="btn btn-outline">Back</button>
            <button id="startPracticeBtn" class="btn btn-primary">Start your practice</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const closeModalFunc = () => modal.remove();

    // Event listeners for the new modal
    document.getElementById('closeExampleModalBtn').onclick = closeModalFunc;
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModalFunc();
        }
    };

    // --- RESTORED FUNCTIONALITY ---
    document.getElementById('startPracticeBtn').onclick = async () => {
        closeModalFunc();
        // The ConversationPractice class is now imported at the top of the file
        const practice = new ConversationPractice();
        await practice.init(state.currentLevel, state.currentScenario, formattedDialog);
    };
}