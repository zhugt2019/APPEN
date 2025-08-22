// frontend/js/api.js (Updated Version)

import { state } from './state.js';

export class API {
    constructor() {
        this.baseURL = ""; 
    }

    // Helper to get headers, including the auth token if available
    _getHeaders(isFormData = false) {
        const headers = {
            'Accept': 'application/json',
        };
        if (state.authToken) {
            headers['Authorization'] = `Bearer ${state.authToken}`;
        }
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    // Unified handler for processing API responses
    async _handleResponse(response) {
        if (response.ok) {
            if (response.status === 204) return null; // Handle No Content response
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (err) {
                return text;
            }
        }
        let errorMessage = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
        } catch (error) {}
        throw new Error(errorMessage);
    }
    
    // Generic request function
    async _request(endpoint, options) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, options);
            return await this._handleResponse(response);
        } catch (error) {
            console.error(`API request to ${endpoint} failed:`, error);
            throw error;
        }
    }

    // --- Authentication Methods ---
    async register(username, password) {
        return this._request('/api/register', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ username, password })
        });
    }

    async login(username, password) {
        return this._request('/api/login', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ username, password })
        });
    }

    // --- Dictionary & Wordbook Methods ---
    async searchWord(query) {
        return this._request(`/api/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: this._getHeaders()
        });
    }

    async getWordbook() {
        return this._request('/api/wordbook', {
            method: 'GET',
            headers: this._getHeaders()
        });
    }
    
    async addToWordbook(word, definition) {
        return this._request('/api/wordbook', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ word, definition })
        });
    }
    
    async removeFromWordbook(wordId) {
        return this._request(`/api/wordbook/${wordId}`, {
            method: 'DELETE',
            headers: this._getHeaders()
        });
    }

    // --- Existing Conversation Methods ---
    async generateScenario(type, options = {}) {
        const body = { level: options.level };
        if (type === 'custom' && options.situation) {
            body.situation = options.situation;
        }
        return this._request('/api/scenarios/random', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(body)
        });
    }

    async transcribeAudio(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording');
        return this._request('/api/transcribe', {
            method: 'POST',
            headers: this._getHeaders(true), // isFormData = true
            body: formData
        });
    }

    async getAiResponse(payload) {
        return this._request('/api/get_ai_response', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(payload)
        });
    }
    
    async getExampleDialogue(level, scenario) {
        return this._request('/api/example_dialogue', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ level, situation: scenario })
        });
    }
}