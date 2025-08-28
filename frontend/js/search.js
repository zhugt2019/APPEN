// frontend/js/search.js (已修改为无限滚动)

import { API } from './api.js';
import { Utils } from './utils.js';
import { renderSearchResults } from './ui.js';

const api = new API();

// --- MODIFIED: 状态变量更新 ---
let currentQuery = '';
let currentPage = 1;
let isLoadingMore = false; // 防止重复加载
let hasMoreResults = true;  // 标记是否还有更多数据

function setupSearchEventListeners() {
    const searchInput = document.getElementById('searchInput');
    // --- THIS IS THE FIX ---
    // The scrolling container is the #search-section element itself.
    const scrollContainer = document.getElementById('search-section'); 
    
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(handleNewSearch, 300));
    }
    
    // Attach the scroll listener to the correct element.
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll);
    }
}

// MODIFIED: 重命名为 handleNewSearch 以明确其功能
function handleNewSearch(event) {
    const query = event.target.value.trim();
    
    // 如果查询内容没变，则不执行任何操作
    if (query === currentQuery) {
        return;
    }
    
    currentQuery = query;   // 更新当前查询
    currentPage = 1;      // 重置页码
    hasMoreResults = true;  // 重置状态
    
    // 如果查询为空，清空结果；否则执行第一次搜索
    if (currentQuery.length < 1) {
        renderSearchResults({ items: [] }, false); // 清空结果
    } else {
        performSearch(false); // 执行新搜索，不追加
    }
}

// MODIFIED: performSearch 现在接受一个 'append' 参数
async function performSearch(append = false) {
    if (currentQuery.length < 1) {
        return;
    }
    
    isLoadingMore = true; // 开始加载
    try {
        const results = await api.searchWord(currentQuery, currentPage);
        renderSearchResults(results, append, currentQuery); // Pass currentQuery
        
        // 更新状态
        hasMoreResults = currentPage < results.total_pages;
        currentPage++; // 准备好加载下一页
        
    } catch (error) {
        console.error("Search failed:", error);
        renderSearchResults(null, false);
    } finally {
        isLoadingMore = false; // 加载结束
    }
}

// ADDED: 滚动事件处理函数
function handleScroll(event) {
    // 如果正在加载或没有更多结果了，则不执行任何操作
    if (isLoadingMore || !hasMoreResults) {
        return;
    }
    
    const element = event.target;
    const threshold = 100; // 距离底部100像素时触发加载
    
    // 判断是否滚动到底部
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
        console.log("Reached bottom, loading more...");
        performSearch(true); // 加载更多并追加结果
    }
}

// REMOVED: 不再需要翻页按钮的监听器
// function setupPaginationEventListeners() { ... }

document.addEventListener('DOMContentLoaded', setupSearchEventListeners);