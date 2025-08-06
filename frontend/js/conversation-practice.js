// frontend/js/conversation-practice.js

import { AudioRecorder } from './recorder.js';
import { API } from './api.js';
import { Utils } from './utils.js';

export class ConversationPractice {
    constructor(options = {}) {
        this.options = {
            onComplete: () => {},
            onError: () => {},
            ...options
        };
        
        this.state = {
            isActive: false,
            currentLevel: 'A2',
            currentScenario: '',
            messages: [],
            isRecording: false,
            isProcessing: false,
            exampleDialog: null,
            // Stores the AI response Audio element created synchronously on user interaction to ensure iOS compatibility.
            currentAiAudioElement: null 
        };
        
        this.recorder = null;
        this.api = null;
        this.container = null;
        this.elements = {};
    }

    /**
     * Initializes the conversation practice module.
     */
    async init(level, scenario, exampleDialog) {
        this.state.currentLevel = level;
        this.state.currentScenario = scenario;
        this.state.exampleDialog = exampleDialog;
        
        this.api = new API();
        this.createUI();
        await this.initRecorder();
        this.show();
        
        if (exampleDialog) {
            this.showReference();
        }
    }

    /**
     * Creates the UI for the practice module.
     */
    createUI() {
        this.container = document.createElement('div');
        this.container.className = 'conversation-practice-overlay';
        
        this.container.innerHTML = `
            <div class="conversation-practice-container">
                <div class="practice-header">
                    <h2>Conversation Practice</h2>
                    <button class="btn btn-ghost btn-icon" data-action="close-practice">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="practice-body">
                    <div class="reference-dialog" id="referenceDialog" style="display: none;">
                        <h3>Example Dialogue</h3>
                        <div class="reference-content"></div>
                        <button class="btn btn-sm btn-ghost" data-action="hide-reference">Hide</button>
                    </div>
                    <div class="practice-messages" id="practiceMessages"></div>
                </div>
                <div class="practice-footer">
                    <button class="btn btn-outline" data-action="show-reference">Show Example</button>
                    <div class="practice-controls">
                        <button class="btn btn-primary record-btn" id="practiceRecordBtn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>
                            <span>Press to Record</span>
                        </button>
                        <div class="recording-indicator" id="recordingIndicator" style="display: none;">
                            <span class="recording-dot"></span>
                            <span>Recording...</span>
                        </div>
                    </div>
                    <button class="btn btn-success" data-action="finish-practice">Finish Practice</button>
                </div>
            </div>
        `;
        
        this.addStyles();
        this.cacheElements();
        this.setupEventListeners();
        document.body.appendChild(this.container);
    }

    /**
     * Adds necessary CSS styles for the module.
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .conversation-practice-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--spacing-md); }
            .conversation-practice-container { background: var(--surface); border-radius: var(--border-radius); width: 100%; max-width: 500px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
            .practice-header { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-md); border-bottom: 1px solid var(--border-color); }
            .practice-body { flex: 1; overflow-y: auto; padding: var(--spacing-md); }
            .reference-dialog { background: var(--background); border-radius: var(--border-radius-sm); padding: var(--spacing-md); margin-bottom: var(--spacing-md); }
            .reference-content { margin: var(--spacing-sm) 0; font-size: var(--font-size-sm); line-height: 1.6; }
            .practice-messages { display: flex; flex-direction: column; gap: var(--spacing-md); min-height: 200px; }
            .practice-controls { text-align: center; }
            .record-btn { user-select: none; touch-action: manipulation; }
            .recording-indicator { display: inline-flex; align-items: center; gap: var(--spacing-sm); color: var(--error-color); font-weight: 500; }
            .recording-dot { width: 12px; height: 12px; background: var(--error-color); border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
            @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
            .practice-footer { display: flex; gap: var(--spacing-sm); padding: var(--spacing-md); border-top: 1px solid var(--border-color); align-items: center; justify-content: space-between; }
            .practice-footer > button { flex: 1; max-width: 150px; }
            .practice-footer .practice-controls { flex-grow: 0; flex-shrink: 0; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Caches DOM elements for quick access.
     */
    cacheElements() {
        this.elements = {
            messagesContainer: this.container.querySelector('#practiceMessages'),
            recordBtn: this.container.querySelector('#practiceRecordBtn'),
            recordingIndicator: this.container.querySelector('#recordingIndicator'),
            referenceDialog: this.container.querySelector('#referenceDialog'),
            referenceContent: this.container.querySelector('.reference-content')
        };
    }

    /**
     * Sets up event listeners for the module.
     */
    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                e.stopPropagation(); 
                switch (action) {
                    case 'close-practice': this.close(); break;
                    case 'show-reference': this.showReference(); break;
                    case 'hide-reference': this.hideReference(); break;
                    case 'finish-practice': this.finish(); break;
                }
            }
        });
        this.setupRecordingEvents();
    }

    /**
     * Sets up events specifically for the record button.
     */
    setupRecordingEvents() {
        const recordBtn = this.elements.recordBtn;
        recordBtn.addEventListener('mousedown', (e) => this.startRecording(e));
        recordBtn.addEventListener('mouseup', (e) => this.stopRecording(e));
        recordBtn.addEventListener('mouseleave', (e) => this.stopRecording(e));
        recordBtn.addEventListener('touchstart', (e) => this.startRecording(e), { passive: false });
        recordBtn.addEventListener('touchend', (e) => this.stopRecording(e), { passive: false });
        recordBtn.addEventListener('touchcancel', (e) => this.stopRecording(e), { passive: false });
    }

    /**
     * Initializes the audio recorder.
     */
    async initRecorder() {
        this.recorder = new AudioRecorder({
            onStart: () => this.handleRecordingStart(),
            onStop: (audioBlob) => this.handleRecordingStop(audioBlob),
            onError: (error) => this.handleRecordingError(error)
        });
        await this.recorder.init();
    }

    /**
     * Starts the recording process.
     */
    startRecording(e) {
        e.preventDefault();
        if (!this.state.isRecording && !this.state.isProcessing) {
            this.recorder.start();
        }
    }

    /**
     * Stops the recording process.
     */
    stopRecording(e) {
        e.preventDefault();
        if (this.state.isRecording) {
            this.recorder.stop();
        }
    }

    /**
     * Handles the UI changes when recording starts.
     */
    handleRecordingStart() {
        this.state.isRecording = true;
        this.elements.recordBtn.classList.add('recording');
        this.elements.recordingIndicator.style.display = 'inline-flex';
        Utils.vibrate(50);
    }

    /**
     * Handles the stop of a recording and sends the audio data.
     */
    async handleRecordingStop(audioBlob) {
        this.state.isRecording = false;
        this.elements.recordBtn.classList.remove('recording');
        this.elements.recordingIndicator.style.display = 'none';

        if (!audioBlob || audioBlob.size < 2000) {
            this.showToast('Recording too short, please try again.');
            this.toggleButtonState(true);
            return;
        }

        // CORE FIX: Synchronously create an Audio instance on user interaction.
        this.state.currentAiAudioElement = new Audio();
        this.state.currentAiAudioElement.preload = 'auto';
        this.state.currentAiAudioElement.onerror = (e) => {
            console.error('Dynamic AI Audio playback error:', e);
            this.showToast('AI audio playback failed, possibly due to browser restrictions.');
        };

        this.toggleButtonState(false, 'sending');
        this.showToast('Sending...');

        try {
            // Pass the pre-created audio element to the send message function.
            await this.sendMessage(audioBlob, this.state.currentAiAudioElement);
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('Failed to send message. Please check your network and try again.');
        } finally {
            this.state.currentAiAudioElement = null; // Clean up the temporary reference.
        }
    }
    
    /**
     * Toggles the state of the record button.
     */
    toggleButtonState(enable = true, text = 'Press to Record') {
        this.elements.recordBtn.disabled = !enable;
        this.elements.recordBtn.querySelector('span').textContent = text;
        this.elements.recordingIndicator.style.display = enable ? 'none' : 'inline-flex';
        this.elements.recordBtn.classList.toggle('recording', !enable);
    }

    /**
     * Sends a message using the two-step API flow to improve reliability.
     * @param {Blob} audioBlob The user's recorded audio.
     * @param {HTMLAudioElement} [aiAudioElement] The pre-created Audio element for the AI response.
     */
    async sendMessage(audioBlob, aiAudioElement = null) {
        if (this.state.isProcessing) return;
        
        this.state.isProcessing = true;
        this.toggleButtonState(false, 'Processing...');
        
        // 1. Add a placeholder for the user's message.
        const userMessageElement = this.addMessage('user', 'Processing...');

        try {
            // --- Step 1 (Fast): Get transcription only ---
            const transcriptionResponse = await this.api.transcribeAudio(audioBlob);
            const userText = transcriptionResponse.transcription;

            if (!userText || !userText.trim()) {
                userMessageElement.remove();
                throw new Error("I'm sorry, I couldn't hear you.");
            }
            
            // 2. Update the user message UI with the real transcription.
            if (userMessageElement) {
                userMessageElement.querySelector('.message-text').textContent = userText;
            }
            this.state.messages.push({ role: 'user', content: userText });

            // 3. Add a placeholder for the AI's message.
            const aiMessageElement = this.addMessage('ai', 'Thinking...');
            aiMessageElement.classList.add('loading');

            // --- Step 2 (Slow): Get the AI response and audio ---
            const aiResponse = await this.api.getAiResponse({
                text: userText,
                history: this.state.messages,
                scenario: this.state.currentScenario,
                level: this.state.currentLevel
            });

            // 4. Update the AI message with real content and handle audio via fetch/blob.
            if (aiResponse.audioUrl && aiAudioElement) {
                const audioResponse = await fetch(aiResponse.audioUrl);
                if (!audioResponse.ok) throw new Error(`Failed to download AI audio: ${audioResponse.statusText}`);
                
                const aiAudioBlob = await audioResponse.blob();
                const blobUrl = URL.createObjectURL(aiAudioBlob);

                aiMessageElement.querySelector('.message-text').textContent = aiResponse.response;
                this.addAudioPlayer(aiMessageElement.querySelector('.message-bubble'), blobUrl, aiAudioElement);
                
                aiAudioElement.onended = () => URL.revokeObjectURL(blobUrl);

            } else if (aiMessageElement) {
                aiMessageElement.querySelector('.message-text').textContent = aiResponse.response;
            }
            
            aiMessageElement.classList.remove('loading');
            this.state.messages.push({ role: 'ai', content: aiResponse.response });

        } catch (error) {
            this.showToast(error.message || 'Failed to send. Please check your network or try again.');
            console.error('Failed to send message:', error);
            if (userMessageElement) userMessageElement.remove();
        } finally {
            this.state.isProcessing = false;
            this.toggleButtonState(true);
        }
    }
    
    /**
     * Helper function to add an audio player to a message bubble.
     */
    addAudioPlayer(bubbleElement, audioUrl, audioElement) {
        if (!bubbleElement) return;

        const audioDiv = document.createElement('div');
        audioDiv.className = 'message-audio';

        audioElement.className = 'audio-player';
        audioElement.src = audioUrl;
        audioElement.preload = 'auto';
        audioElement.controls = true; // Show native controls for best compatibility.

        audioDiv.appendChild(audioElement);
        bubbleElement.appendChild(audioDiv);
    }

    /**
     * Adds a message to the UI.
     * @param {string} role 'user' or 'ai'.
     * @param {string} text The message text.
     * @param {string|null} audioUrl The URL for the audio.
     * @param {HTMLAudioElement|null} [aiAudioElement] Pre-created Audio element for AI messages.
     */
    addMessage(role, text, audioUrl = null, aiAudioElement = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? 'U' : 'AI';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const textElement = document.createElement('div');
        textElement.className = 'message-text';
        textElement.textContent = text;
        
        bubble.appendChild(textElement);

        if (audioUrl) {
            // Use the pre-created audio element for AI messages if available.
            const audioElement = (role === 'ai' && aiAudioElement) ? aiAudioElement : document.createElement('audio');
            this.addAudioPlayer(bubble, audioUrl, audioElement);
        }

        content.appendChild(bubble);
        
        if (role === 'user') {
            messageDiv.appendChild(content);
            messageDiv.appendChild(avatar);
        } else {
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
        }

        this.elements.messagesContainer.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
        
        return messageDiv;
    }
    
    /**
     * Shows the reference dialogue.
     */
    showReference() {
        if (this.state.exampleDialog) {
            this.elements.referenceContent.innerHTML = this.state.exampleDialog;
            this.elements.referenceDialog.style.display = 'block';
        }
    }

    /**
     * Hides the reference dialogue.
     */
    hideReference() {
        this.elements.referenceDialog.style.display = 'none';
    }

    /**
     * Shows a toast notification via the main app instance.
     */
    showToast(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message);
        }
    }

    /**
     * Shows the practice UI.
     */
    show() {
        this.container.classList.add('active');
        this.state.isActive = true;
    }

    /**
     * Closes the practice UI.
     */
    close() {
        this.container.classList.remove('active');
        this.state.isActive = false;
        setTimeout(() => this.destroy(), 300);
    }

    /**
     * Finishes the practice session.
     */
    async finish() {
        if (this.state.messages.length > 0) {
            // A review/scoring feature could be added here.
            this.showToast('Practice completed!');
        }
        
        this.options.onComplete(this.state.messages);
        this.close();
    }

    /**
     * Destroys the instance and cleans up resources.
     */
    destroy() {
        this.recorder?.cleanup();
        this.container?.remove();
    }

    /**
     * Handles recording errors.
     */
    handleRecordingError(error) {
        this.state.isRecording = false;
        this.elements.recordBtn.classList.remove('recording');
        this.elements.recordingIndicator.style.display = 'none';
        this.showToast(error.message || 'Recording failed');
    }
}
