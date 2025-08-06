// frontend/js/app.js

import { AudioRecorder } from './recorder.js';
import { API } from './api.js';
import { Utils } from './utils.js';

/**
 * Main application class, refactored to be compatible with multiple event binding strategies.
 */
class Appen {
    constructor() {
        this.state = {
            currentLevel: 'A2',
            currentScenario: '',
            messages: [],
            isRecording: false,
            isLoading: false,
            audioPreloadCache: new Map(),
            // Stores the AI response Audio element created synchronously on user interaction to ensure iOS compatibility.
            currentAiAudioElement: null 
        };
        
        this.recorder = null;
        this.api = null;
        this.elements = {};
        
        // Performance optimization: cache DOM element references.
        this.domCache = new Map();
        
        // Throttled and debounced functions for performance.
        this.throttledUpdateVisualizer = Utils.throttle(this.updateVisualizer.bind(this), 50);
        this.debouncedSaveSession = Utils.debounce(this.saveSession.bind(this), 1000);
        
        // Error retry mechanism.
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Initializes the application.
     */
    async init() {
        console.log('Initializing Appen...');
        
        try {
            // Initialize the API client.
            this.api = new API();
            
            // Cache DOM elements.
            this.cacheElements();
            
            // Set up event listeners using a compatible approach.
            this.setupEventListeners();
            
            // Check and restore session state.
            this.restoreSession();
            
            // Generate the initial scenario.
            await this.generateScenario('random');
            
            // Check for necessary permissions.
            await this.checkPermissions();
            
            // Preload common resources.
            this.preloadResources();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('App initialization failed. Please refresh the page.');
        }
    }

    /**
     * Caches DOM elements for faster access.
     */
    cacheElements() {
        // Strategy 1: Directly cache known element IDs.
        this.elements = {
            menuBtn: document.getElementById('menuBtn'),
            levelButtons: document.querySelectorAll('.level-button'),
            scenarioText: document.getElementById('scenarioText'),
            randomScenarioBtn: document.getElementById('randomScenarioBtn'),
            customScenarioBtn: document.getElementById('customScenarioBtn'),
            chatContainer: document.getElementById('chatContainer'),
            recordingInterface: document.getElementById('recordingInterface'),
            recordButton: document.getElementById('recordButton'),
            recordingStatusText: document.getElementById('recordingStatusText'),
            recordingTime: document.getElementById('recordingTime'),
            audioVisualizer: document.getElementById('audioVisualizer'),
            fabRecord: document.getElementById('fabRecord'),
            permissionModal: document.getElementById('permissionModal'),
            customScenarioModal: document.getElementById('customScenarioModal'),
            customScenarioInput: document.getElementById('customScenarioInput'),
            toast: document.getElementById('toast')
        };

        // Strategy 2: Also find buttons using data-action attributes.
        this.actionButtons = {
            'generate-random-scenario': document.querySelector('[data-action="generate-random-scenario"]'),
            'show-custom-scenario': document.querySelector('[data-action="show-custom-scenario"]'),
            'show-example-dialog': document.querySelector('[data-action="show-example-dialog"]'),
            'show-recording': document.querySelector('[data-action="show-recording"]'),
            'select-level': document.querySelectorAll('[data-action="select-level"]'),
            'enable-microphone': document.querySelector('[data-action="enable-microphone"]'),
            'close-modal': document.querySelectorAll('[data-action="close-modal"]'),
            'generate-custom-scenario': document.querySelector('[data-action="generate-custom-scenario"]')
        };

        // Cache commonly queried selectors.
        this.elements.modals = document.querySelectorAll('.modal-overlay');
        
        console.log('Elements cached:', {
            direct: Object.keys(this.elements).filter(k => this.elements[k]),
            actions: Object.keys(this.actionButtons).filter(k => this.actionButtons[k])
        });
    }

    /**
     * Sets up event listeners, supporting both direct and delegated binding.
     */
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Strategy 1: Direct binding (for original HTML structure).
        this.setupDirectEventListeners();
        
        // Strategy 2: Event delegation (for data-action structure).
        this.setupDelegatedEventListeners();
        
        // General event listeners (keyboard, visibility, etc.).
        this.setupGeneralEventListeners();
        
        console.log('Event listeners setup completed');
    }

    /**
     * Binds events directly to elements (compatible with original HTML).
     */
    setupDirectEventListeners() {
        this.elements.menuBtn?.addEventListener('click', () => this.toggleMenu());
        
        this.elements.levelButtons?.forEach(btn => {
            btn.addEventListener('click', () => this.selectLevel(btn.dataset.level));
        });
        
        this.elements.randomScenarioBtn?.addEventListener('click', () => this.generateScenario('random'));
        this.elements.customScenarioBtn?.addEventListener('click', () => this.showCustomScenarioModal());
        
        this.elements.fabRecord?.addEventListener('click', () => this.showRecordingInterface());
        
        document.getElementById('customScenarioGenerate')?.addEventListener('click', () => this.generateCustomScenario());
        document.getElementById('customScenarioCancel')?.addEventListener('click', () => this.closeModal('customScenarioModal'));
        
        document.getElementById('enableMicrophoneBtn')?.addEventListener('click', () => this.requestMicrophonePermission());
        document.getElementById('permissionLaterBtn')?.addEventListener('click', () => this.closeModal('permissionModal'));
        
        const recordBtn = this.elements.recordButton;
        if (recordBtn) {
            // Mouse events
            recordBtn.addEventListener('mousedown', () => this.startMainRecording());
            recordBtn.addEventListener('mouseup', () => this.stopMainRecording());
            recordBtn.addEventListener('mouseleave', () => this.stopMainRecording());
            
            // Touch events for mobile compatibility
            recordBtn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent default actions like scrolling
                this.startMainRecording();
            }, { passive: false });
            recordBtn.addEventListener('touchend', () => this.stopMainRecording());
            recordBtn.addEventListener('touchcancel', () => this.stopMainRecording());
        }

        console.log('Direct event listeners bound');
    }

    /**
     * Binds events using delegation (compatible with data-action HTML).
     */
    setupDelegatedEventListeners() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            console.log(`Action clicked: ${action}`);
            e.preventDefault();
            
            try {
                switch (action) {
                    case 'toggle-menu': this.toggleMenu(); break;
                    case 'select-level': this.selectLevel(target.dataset.level); break;
                    case 'generate-random-scenario': this.generateScenario('random'); break;
                    case 'show-custom-scenario': this.showCustomScenarioModal(); break;
                    case 'show-recording': this.showRecordingInterface(); break;
                    case 'generate-custom-scenario': this.generateCustomScenario(); break;
                    case 'close-modal': this.closeModal(target.closest('.modal-overlay')?.id); break;
                    case 'show-example-dialog': this.showExampleDialog(); break;
                    case 'enable-microphone': this.requestMicrophonePermission(); break;
                    default: console.warn(`Unknown action: ${action}`);
                }
            } catch (error) {
                console.error(`Error handling action ${action}:`, error);
                this.showToast(`Operation failed: ${error.message}`);
            }
        });
        
        console.log('Delegated event listeners bound');
    }

    /**
     * Sets up general, non-UI-specific event listeners.
     */
    setupGeneralEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
            if (e.key === 'Enter' && e.target.id === 'customScenarioInput') this.generateCustomScenario();
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.isRecording) this.recorder?.stop();
        });
        
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        window.addEventListener('beforeunload', () => this.cleanup());
        
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });
    }

    /**
     * Initializes the audio recorder.
     */
    async initRecorder() {
        try {
            this.recorder = new AudioRecorder({
                onStart: () => this.handleRecordingStart(),
                onStop: (audioBlob) => this.handleRecordingStop(audioBlob),
                onError: (error) => this.handleRecordingError(error),
                onVolumeChange: (volume) => this.throttledUpdateVisualizer(volume)
            });
            await this.recorder.init();
        } catch (error) {
            console.error('Failed to initialize recorder:', error);
            this.showToast('Audio recorder initialization failed.');
        }
    }

    /**
     * Checks and requests necessary permissions.
     */
    async checkPermissions() {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            if (result.state === 'denied') {
                this.showModal('permissionModal');
            }
        } catch (error) {
            console.log('Permissions API not available, will prompt on first use.');
        }
    }

    /**
     * Requests microphone permission from the user.
     */
    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Immediately stop the track, we just wanted permission.
            this.closeModal('permissionModal');
            this.showToast('Microphone access granted.');
        } catch (error) {
            this.showToast('Microphone access denied. Please enable it in your settings.');
        }
    }

    /**
     * Restores session state from local storage.
     */
    restoreSession() {
        try {
            const savedState = Utils.storage.get('AppenState');
            if (savedState && savedState.timestamp && (Date.now() - savedState.timestamp < 24 * 60 * 60 * 1000)) {
                this.state.currentLevel = savedState.currentLevel || 'A2';
                this.selectLevel(this.state.currentLevel);
            }
        } catch (error) {
            console.error('Failed to restore session:', error);
        }
    }

    /**
     * Saves session state to local storage (debounced).
     */
    saveSession() {
        const stateToSave = {
            currentLevel: this.state.currentLevel,
            timestamp: Date.now()
        };
        Utils.storage.set('AppenState', stateToSave);
    }

    /**
     * Selects the language proficiency level.
     */
    selectLevel(level) {
        console.log(`Selecting level: ${level}`);
        this.state.currentLevel = level;
        
        // Update UI for both button types
        document.querySelectorAll('.level-button, [data-action="select-level"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === level);
        });
        
        this.debouncedSaveSession();
        this.showToast(`Language level switched to ${level}`);
    }

    /**
     * Generates a new scenario, with a retry mechanism.
     */
    async generateScenario(type, retryCount = 0) {
        if (this.state.isLoading) return;
        
        console.log(`Generating ${type} scenario...`);
        this.state.isLoading = true;
        this.showScenarioLoading();
        
        try {
            const data = await this.api.generateScenario(type, {
                level: this.state.currentLevel,
                situation: type === 'custom' ? this.elements.customScenarioInput?.value : undefined
            });
            
            this.state.currentScenario = data.scenario;
            this.elements.scenarioText.textContent = data.scenario;
            
            this.clearChatHistory();
            
            if (type === 'custom') {
                this.closeModal('customScenarioModal');
            }
            
            this.showToast('New scenario generated!');
            this.retryCount = 0;
            
        } catch (error) {
            console.error('Failed to generate scenario:', error);
            
            if (retryCount < this.maxRetries) {
                console.log(`Retrying scenario generation (${retryCount + 1}/${this.maxRetries})`);
                setTimeout(() => this.generateScenario(type, retryCount + 1), 1000 * (retryCount + 1));
                return;
            }
            
            this.elements.scenarioText.textContent = 'Failed to generate scenario. Please try again.';
            this.showToast('Scenario generation failed. Please check your network connection.');
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * Displays a loading skeleton in the scenario box.
     */
    showScenarioLoading() {
        if (this.elements.scenarioText) {
            this.elements.scenarioText.innerHTML = `
                <div class="skeleton" style="height: 20px; margin-bottom: 8px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite;"></div>
                <div class="skeleton" style="height: 20px; width: 80%; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite;"></div>
            `;
        }
    }

    /**
     * Shows the custom scenario modal.
     */
    showCustomScenarioModal() {
        if (this.elements.customScenarioInput) {
            this.elements.customScenarioInput.value = '';
        }
        this.showModal('customScenarioModal');
        setTimeout(() => this.elements.customScenarioInput?.focus(), 100);
    }

    /**
     * Generates a scenario based on user input.
     */
    generateCustomScenario() {
        const input = this.elements.customScenarioInput?.value?.trim();
        if (!input) {
            this.showToast('Please describe a situation.');
            return;
        }
        if (input.length < 3) {
            this.showToast('Situation description is too short.');
            return;
        }
        this.generateScenario('custom');
    }

    /**
     * Shows the recording interface.
     */
    showRecordingInterface() {
        this.elements.recordingInterface?.classList.add('active');
        Utils.vibrate(50);
    }

    /**
     * Shows the example dialogue modal.
     */
    async showExampleDialog() {
        const button = document.querySelector('[data-action="show-example-dialog"]');
        if (button.disabled) return;

        try {
            button.disabled = true;
            button.textContent = 'Loading...';
            
            const data = await this.api.getExampleDialogue(this.state.currentLevel, this.state.currentScenario);
            
            const modal = this.createExampleModal(data);
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Failed to load example:', error);
            this.showToast('Failed to load example dialogue.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7L12 12L22 7L12 2Z"></path><path d="M2 17L12 22L22 17"></path><path d="M2 12L12 17L22 12"></path></svg><span>View Example Dialog</span>`;
            }
        }
    }

    /**
     * Handles the start of a recording.
     */
    handleRecordingStart() {
        console.log('Recording started');
        this.state.isRecording = true;
        
        this.elements.recordButton?.classList.add('recording');
        this.elements.recordingStatusText.textContent = 'Recording...';
        this.elements.recordingTime.classList.remove('hidden');
        this.elements.audioVisualizer.classList.remove('hidden');
        
        Utils.vibrate(50);
    }

    /**
     * Handles the end of a recording and processes the audio.
     */
    handleRecordingStop(audioBlob) {
        console.log('Recording stopped, blob size:', audioBlob.size, 'type:', audioBlob.type);
        this.state.isRecording = false;
        
        this.elements.recordButton?.classList.remove('recording');
        this.elements.recordingStatusText.textContent = 'Processing...';
        
        if (audioBlob.size < 1000) { // 1KB is very short for any format
            this.showToast('Recording too short, please try again.');
            this.elements.recordingInterface?.classList.remove('active');
            return;
        }

        // For iOS compatibility, create the Audio element synchronously.
        this.state.currentAiAudioElement = new Audio();

        // Pass the blob and the pre-created Audio element to the main processing function.
        this.processNewMessage(audioBlob, this.state.currentAiAudioElement);
        
        setTimeout(() => this.elements.recordingInterface?.classList.remove('active'), 500);
    }

    /**
     * Handles any recording errors.
     */
    handleRecordingError(error) {
        console.error('Recording error:', error);
        this.state.isRecording = false;
        
        this.elements.recordButton?.classList.remove('recording');
        this.elements.recordingInterface?.classList.remove('active');
        
        this.showToast(error.message || 'Recording failed.');
    }

    /**
     * Starts recording from the main interface, lazy-loading the recorder if needed.
     */
    async startMainRecording() {
        // Initialize the recorder on first use. This will trigger the permission prompt.
        if (!this.recorder) {
            try {
                this.showToast('Preparing recorder...');
                await this.initRecorder();
            } catch (error) {
                console.error("Recorder initialization failed:", error);
                this.showToast(error.message || "Cannot access microphone. Please check permissions.");
                return; // Stop if initialization fails.
            }
        }

        if (this.recorder && !this.state.isRecording) {
            this.recorder.start();
        }
    }

    /**
     * Stops recording from the main interface.
     */
    stopMainRecording() {
        if (this.recorder && this.state.isRecording) {
            this.recorder.stop();
        }
    }

    /**
     * Updates the audio visualizer display.
     */
    updateVisualizer(volumeData) {
        if (!this.elements.audioVisualizer) return;
        
        const bars = this.elements.audioVisualizer.querySelectorAll('.audio-bar');
        volumeData.forEach((volume, index) => {
            if (bars[index]) {
                const height = Math.max(4, volume * 36);
                bars[index].style.height = `${height}px`;
            }
        });
    }

    /**
     * Main flow for processing a new message using a two-step API call.
     * @param {Blob} audioBlob - The recorded audio.
     * @param {HTMLAudioElement} aiAudioElement - The pre-created Audio element for iOS.
     */
    async processNewMessage(audioBlob, aiAudioElement) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;

        // 1. Add a "transcribing..." placeholder message to the UI.
        const userMessageElement = this.addMessage('user', 'Processing...');
        userMessageElement.classList.add('loading');

        try {
            // --- Step 1 (Fast): Get transcription text ---
            const transcriptionResponse = await this.api.transcribeAudio(audioBlob);
            const userText = transcriptionResponse.transcription;

            if (!userText || !userText.trim()) {
                userMessageElement.remove(); // Remove placeholder if nothing was transcribed.
                throw new Error("Sorry, I didn't catch that. Please try again.");
            }
            
            // 2. Update the user message with the actual transcription.
            this.updateMessage(userMessageElement, userText);
            userMessageElement.classList.remove('loading');
            this.state.messages.push({ role: 'user', content: userText });

            // 3. Add an "AI is thinking..." placeholder message.
            const aiMessageElement = this.addMessage('ai', '...');
            aiMessageElement.classList.add('loading');

            // --- Step 2 (Slow): Get AI response and audio ---
            const aiResponse = await this.api.getAiResponse({
                text: userText,
                history: this.state.messages,
                scenario: this.state.currentScenario,
                level: this.state.currentLevel
            });

            // 4. Update the AI message with the real content and handle audio.
            this.updateMessage(aiMessageElement, aiResponse.response, aiResponse.audioUrl, aiAudioElement);
            aiMessageElement.classList.remove('loading');
            this.state.messages.push({ role: 'ai', content: aiResponse.response });

        } catch (error) {
            console.error('Message processing failed:', error);
            this.showToast(error.message || 'An error occurred while processing the message.');
            if (userMessageElement && userMessageElement.classList.contains('loading')) {
                userMessageElement.remove();
            }
        } finally {
            this.state.isLoading = false;
            this.state.currentAiAudioElement = null; // Clean up the temporary Audio element reference.
        }
    }

    /**
     * Adds a message to the chat UI.
     * @param {string} role 'user' or 'ai'.
     * @param {string} text The message content.
     * @param {string|null} audioUrl The URL for the audio, if any.
     * @param {HTMLAudioElement|null} [aiAudioElement] Pre-created Audio element for AI messages.
     */
    addMessage(role, text, audioUrl = null, aiAudioElement = null) {
        const message = { role, content: text, audioUrl, timestamp: new Date() };
        this.state.messages.push(message);
        
        const messageElement = this.createMessageElement(message, aiAudioElement);

        // Defensive check to prevent critical errors.
        if (!this.elements.chatContainer) {
            alert('FATAL ERROR: The chatContainer element was not found. The app cannot add new messages.');
            console.error('FATAL ERROR: this.elements.chatContainer is null. Caching likely failed during initialization.');
            return;
        }

        this.elements.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        return messageElement;
    }

    /**
     * Updates an existing message element with new text and optional audio.
     */
    updateMessage(messageElement, text, audioUrl = null, aiAudioElement = null) {
        if (!messageElement) return;

        const textElement = messageElement.querySelector('.message-text');
        if (textElement) textElement.textContent = text;

        if (audioUrl && aiAudioElement) {
            const messageContentBubble = messageElement.querySelector('.message-bubble');
            
            // Use the most compatible audio playback method (fetch -> blob).
            fetch(audioUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);
                    return response.blob();
                })
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    aiAudioElement.src = blobUrl;
                    aiAudioElement.className = 'audio-player';
                    aiAudioElement.controls = true;
                    
                    const oldPlayer = messageContentBubble.querySelector('.audio-player');
                    if(oldPlayer) oldPlayer.remove();

                    messageContentBubble.appendChild(aiAudioElement);

                    aiAudioElement.onended = () => URL.revokeObjectURL(blobUrl);
                })
                .catch(err => {
                    console.error("Audio playback setup failed:", err);
                    const errorP = document.createElement('p');
                    errorP.textContent = `[Audio failed to load: ${err.message}]`;
                    errorP.style.cssText = 'font-size: 12px; color: red;';
                    messageContentBubble.appendChild(errorP);
                });
        }
    }

    /**
     * Creates the DOM element for a message.
     */
    createMessageElement(message, aiAudioElement = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role} animate-slide-up`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? 'U' : 'AI';

        const content = document.createElement('div');
        content.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message.content;

        bubble.appendChild(text);

        if (message.audioUrl) {
            const audioDiv = document.createElement('div');
            audioDiv.className = 'message-audio';

            // Use the pre-created audio element for AI messages if provided.
            const audioElement = (message.role === 'ai' && aiAudioElement) ? aiAudioElement : document.createElement('audio');
            
            audioElement.className = 'audio-player';
            audioElement.src = message.audioUrl;
            audioElement.preload = 'auto';
            audioElement.style.display = 'none'; // Hide native player in favor of custom button.
            audioDiv.appendChild(audioElement); // CRITICAL: Add the element to the DOM.

            // Custom player UI
            const customPlayButton = document.createElement('button');
            customPlayButton.className = 'btn btn-icon btn-sm audio-play-button';
            customPlayButton.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

            const audioTimeDisplay = document.createElement('span');
            audioTimeDisplay.className = 'audio-time';
            audioTimeDisplay.textContent = '00:00 / 00:00';

            const playerControls = document.createElement('div');
            playerControls.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            playerControls.appendChild(customPlayButton);
            playerControls.appendChild(audioTimeDisplay);

            audioDiv.appendChild(playerControls);
            bubble.appendChild(audioDiv);

            // Event bindings for custom player
            customPlayButton.addEventListener('click', () => {
                if (audioElement.paused || audioElement.ended) {
                    audioElement.play().catch(e => {
                        console.error("Custom play button: Auto-play blocked or error:", e);
                        this.showToast('Could not play audio. Playback may be restricted by your browser.');
                    });
                } else {
                    audioElement.pause();
                }
            });

            audioElement.addEventListener('play', () => customPlayButton.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14.016 5.016h3.984v13.969h-3.984v-13.969zM6 18.984v-13.969h3.984v13.969h-3.984z"/></svg>`);
            audioElement.addEventListener('pause', () => customPlayButton.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`);
            audioElement.addEventListener('ended', () => {
                customPlayButton.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
                audioTimeDisplay.textContent = '00:00 / ' + Utils.formatTime(audioElement.duration);
            });
            audioElement.addEventListener('timeupdate', () => audioTimeDisplay.textContent = `${Utils.formatTime(audioElement.currentTime)} / ${Utils.formatTime(audioElement.duration)}`);
            audioElement.addEventListener('loadedmetadata', () => audioTimeDisplay.textContent = '00:00 / ' + Utils.formatTime(audioElement.duration));
        }

        content.appendChild(bubble);

        if (message.role === 'user') {
            messageDiv.appendChild(content);
            messageDiv.appendChild(avatar);
        } else {
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
        }

        return messageDiv;
    }

    /**
     * Scrolls the chat container to the bottom.
     */
    scrollToBottom() {
        if (this.elements.chatContainer) {
            setTimeout(() => {
                this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
            }, 100);
        }
    }

    /**
     * Clears the chat history from state and UI.
     */
    clearChatHistory() {
        this.state.messages = [];
        if (this.elements.chatContainer) {
            this.elements.chatContainer.innerHTML = '';
        }
    }

    /**
     * Creates the example dialogue modal with fixes for mobile overflow.
     */
    createExampleModal(data) {
        const existingModal = document.getElementById('exampleModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'exampleModal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal';
        modalContent.style.cssText = `display: flex; flex-direction: column; max-height: 85vh; width: 100%;`;

        const title = document.createElement('h2');
        title.textContent = `Example dialogue (${data.level})`;
        title.style.flexShrink = '0';
        modalContent.appendChild(title);
        
        const dialogContent = document.createElement('div');
        dialogContent.className = 'example-dialog-content';
        dialogContent.style.cssText = `flex: 1; overflow-y: auto; margin: 15px 0; padding: 15px; background: var(--background); border-radius: 8px; line-height: 1.8; white-space: pre-wrap;`;
        
        const formattedDialog = data.dialog.split('\n').map(line => {
            if (line.startsWith('Jag:')) return `<div style="margin: 8px 0; color: #1E88E5;"><strong>${line}</strong></div>`;
            if (line.startsWith('Du:')) return `<div style="margin: 8px 0; color: #4CAF50;"><strong>${line}</strong></div>`;
            return `<div style="margin: 4px 0;">${line}</div>`;
        }).join('');

        dialogContent.innerHTML = formattedDialog;
        modalContent.appendChild(dialogContent);
        
        const audioContainer = document.createElement('div');
        audioContainer.style.cssText = 'margin-bottom: 20px; flex-shrink: 0;';
        if (data.audio_url) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = data.audio_url;
            audio.style.width = '100%';
            audioContainer.appendChild(audio);
        }
        modalContent.appendChild(audioContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: auto; padding-top: 15px; flex-shrink: 0;';

        const practiceButton = document.createElement('button');
        practiceButton.className = 'btn btn-primary';
        practiceButton.textContent = 'Start your practice';
        practiceButton.style.flex = '1';
        practiceButton.onclick = async () => {
            this.closeExampleModal();
            const { ConversationPractice } = await import('./conversation-practice.js');
            const practice = new ConversationPractice();
            await practice.init(this.state.currentLevel, this.state.currentScenario, formattedDialog);
        };
        
        const closeButton = document.createElement('button');
        closeButton.className = 'btn btn-outline';
        closeButton.textContent = 'Back';
        closeButton.style.flex = '1';
        closeButton.onclick = () => this.closeExampleModal();
        
        buttonContainer.appendChild(closeButton);
        buttonContainer.appendChild(practiceButton);
        modalContent.appendChild(buttonContainer);

        modal.appendChild(modalContent);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeExampleModal();
        });
        
        return modal;
    }

    /**
     * Closes the example dialogue modal.
     */
    closeExampleModal() {
        const modal = document.getElementById('exampleModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * Preloads audio resources.
     */
    preloadAudio(url) {
        if (!url || this.state.audioPreloadCache.has(url)) return;
        
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        this.state.audioPreloadCache.set(url, audio);
        
        // Limit cache size.
        if (this.state.audioPreloadCache.size > 10) {
            const firstKey = this.state.audioPreloadCache.keys().next().value;
            this.state.audioPreloadCache.delete(firstKey);
        }
    }

    /**
     * Preloads various application resources.
     */
    preloadResources() {
        console.log('Preloading resources...');
    }

    /**
     * Shows a modal by its ID.
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            const firstInput = modal.querySelector('input, button');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }
    }

    /**
     * Closes a modal by its ID.
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    /**
     * Closes all active modals.
     */
    closeAllModals() {
        this.elements.modals?.forEach(modal => modal.classList.remove('active'));
    }

    /**
     * Shows a toast notification.
     */
    showToast(message, duration = 3000) {
        console.log(`Toast: ${message}`);
        if (!this.elements.toast) return;
        
        this.elements.toast.textContent = message;
        this.elements.toast.classList.add('show');
        
        if (this.toastTimer) clearTimeout(this.toastTimer);
        
        this.toastTimer = setTimeout(() => this.elements.toast.classList.remove('show'), duration);
    }

    /**
     * Toggles the main menu (placeholder).
     */
    toggleMenu() {
        this.showToast('Menu feature coming soon!');
    }

    /**
     * Handles the browser coming online.
     */
    handleOnline() {
        this.showToast('Network connection restored.');
    }

    /**
     * Handles the browser going offline.
     */
    handleOffline() {
        this.showToast('You are now offline.');
    }

    /**
     * Cleans up resources before the page unloads.
     */
    cleanup() {
        this.state.audioPreloadCache.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        this.state.audioPreloadCache.clear();
        
        this.recorder?.cleanup?.();
        if (this.toastTimer) clearTimeout(this.toastTimer);
    }
}

// Initialize the app when the DOM is ready.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM loaded, initializing app...');
        const app = new Appen();
        await app.init();
        
        window.app = app; // Make app globally accessible for debugging.
        
        // Add keyframe animations dynamically.
        const style = document.createElement('style');
        style.textContent = `
            @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .animate-slide-up { animation: slideUp 0.3s ease-out; }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div style="text-align: center; margin-top: 50px;">
                <h2>App failed to start</h2>
                <p>Please refresh the page to try again.</p>
                <button onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
});
