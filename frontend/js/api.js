// frontend/js/api.js

/**
 * API Client Class
 * Handles all communication with the backend API.
 * This version includes fixes for method calls and removes inconsistencies.
 */
export class API {
    constructor() {
        // Set the base URL based on the environment.
        this.baseURL = this.getBaseURL();
        this.headers = {
            'Accept': 'application/json',
        };
    }

    /**
     * Gets the base URL depending on the environment.
     */
    getBaseURL() {
        // In a production environment, this path is relative to the root, so an empty string is correct.
        // Modify this if your API is deployed in a different subdirectory or domain.
        return "";
    }

    /**
     * Step 1: Transcribe audio only.
     * @param {Blob} audioBlob - The audio blob from MediaRecorder.
     */
    async transcribeAudio(audioBlob) {
        const formData = new FormData();
        // The backend's pydub can handle webm/mp4 formats, so no specific file extension is needed.
        formData.append('audio', audioBlob, 'recording'); 
        
        // FIX: Changed from a generic fetch to postFormData, as it sends file data.
        return await this.postFormData('/api/transcribe', formData);
    }

    /**
     * Step 2: Get the AI response and corresponding audio.
     * @param {object} payload - Contains transcribed text, history, etc.
     */
    async getAiResponse(payload) {
        // FIX: Changed from a generic fetch to post, as it sends JSON data.
        return await this.post('/api/get_ai_response', payload);
    }

    /**
     * Generates a random or custom scenario.
     */
    async generateScenario(type, options = {}) {
        const endpoint = '/api/scenarios/random'; 
        const body = { 
            level: options.level 
        };

        if (type === 'custom' && options.situation) {
            body.situation = options.situation;
        }
        
        // CONFIRMED: This 'post' call is correct and resolves the original console error.
        return await this.post(endpoint, body);
    }

    /**
     * Processes a chat message that includes audio (legacy flow for conversation-practice.js).
     */
    async processChat(data) {
        const formData = new FormData();
        
        // Set a simple filename without MIME type information.
        const filename = 'recording.wav';
        
        formData.append('audio', data.audio, filename);
        formData.append('scenario', data.scenario);
        formData.append('level', data.level);
        formData.append('history', JSON.stringify(data.history));

        return await this.postFormData('/api/chat/process', formData);
    }

    /**
     * Gets an example dialogue for a given scenario.
     */
    async getExampleDialogue(level, situation = null) {
        const endpoint = '/api/example_dialogue';
        const body = {
            level: level
        };
        
        if (situation) {
            body.situation = situation;
        }
        
        return await this.post(endpoint, body);
    }

    /**
     * Generates audio for a dialogue text.
     */
    async generateDialogueAudio(dialogText) {
        const formData = new FormData();
        formData.append('dialog_text', dialogText);
        
        return await this.postFormData('/api/generate_dialogue_audio', formData);
    }

    /**
     * Submits a conversation for performance review.
     */
    async reviewPerformance(messages, scenario, level) {
        return await this.post('/api/review/performance', {
            messages,
            scenario,
            level
        });
    }

    /**
     * Generic GET request handler.
     */
    async get(endpoint) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'GET',
                headers: this.headers
            });
            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Generic POST request handler for JSON data.
     */
    async post(endpoint, data) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Generic POST request handler for FormData.
     */
    async postFormData(endpoint, formData) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    ...this.headers
                    // Note: When sending FormData, do not manually set the 'Content-Type' header.
                    // The browser will automatically add it with the correct boundary.
                },
                body: formData
            });
            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Unified handler for processing API responses.
     */
    async handleResponse(response) {
        if (response.ok) {
            // Try to parse as JSON; if it fails, return as text.
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (err) {
                return text;
            }
        }

        // Handle error responses.
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.detail) {
                errorMessage = errorData.detail;
            }
        } catch (error) {
            // If the error response is not JSON, keep the original message.
        }
        throw new Error(errorMessage);
    }

    /**
     * Unified handler for network errors.
     */
    handleError(error) {
        if (error.message.includes('Failed to fetch')) {
            return new Error('Network error. Please check your connection.');
        }
        return error;
    }

    /**
     * Checks the health status of the API.
     */
    async checkHealth() {
        try {
            const response = await this.get('/');
            return response.status === 'ok';
        } catch (error) {
            return false;
        }
    }
}
