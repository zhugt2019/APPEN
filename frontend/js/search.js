// frontend/js/search.js (FINAL VERSION)
import { API } from './api.js';
import { Utils } from './utils.js';
import { renderSearchResults } from './ui.js';

const api = new API();

function setupSearchEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(handleSearch, 300));
    }
}

async function handleSearch(event) {
    const query = event.target.value.trim();
    if (query.length < 1) {
        renderSearchResults([]);
        return;
    }
    try {
        const results = await api.searchWord(query);
        renderSearchResults(results);
    } catch (error) {
        console.error("Search failed:", error);
        renderSearchResults(null);
    }
}

document.addEventListener('DOMContentLoaded', setupSearchEventListeners);