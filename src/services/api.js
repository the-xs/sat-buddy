import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const message = error.response?.data?.message || error.message || 'An error occurred';
        console.error('API Error:', message);
        return Promise.reject(new Error(message));
    }
);

// Question API
export const questionAPI = {
    // Get all questions with optional category filter
    getAll: (category = null) => {
        const params = category ? { category } : {};
        return api.get('/questions', { params });
    },

    // Get single question
    getById: (id) => api.get(`/questions/${id}`),

    // Create question
    create: (data) => api.post('/questions', data),

    // Update question
    update: (id, data) => api.put(`/questions/${id}`, data),

    // Delete question
    delete: (id) => api.delete(`/questions/${id}`),

    // Get random questions for test
    getRandom: (category, count) => {
        return api.get('/questions/random', {
            params: { category, count }
        });
    },

    // Get question statistics
    getStats: () => api.get('/questions/stats')
};

// SAT Test API (new structure)
export const satTestAPI = {
    // Get all SAT tests
    getAll: () => api.get('/tests'),

    // Get single SAT test with modules
    getById: (id) => api.get(`/tests/${id}`),

    // Get questions for a specific module
    getModuleQuestions: (testId, moduleId) => api.get(`/tests/${testId}/modules/${moduleId}/questions`),

    // Get test statistics
    getStats: (testId) => api.get(`/tests/${testId}/stats`),

    // Delete a test
    delete: (testId) => api.delete(`/tests/${testId}`),

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    // Create a new test session
    createSession: (testId) => api.post('/tests/session', { testId }),

    // Get a session
    getSession: (sessionId) => api.get(`/tests/session/${sessionId}`),

    // Record an answer
    recordAnswer: (sessionId, questionId, answer) => api.post(`/tests/session/${sessionId}/answer`, { questionId, answer }),

    // Submit a session
    submitSession: (sessionId) => api.post(`/tests/session/${sessionId}/submit`),

    // Get detailed results for review
    getSessionResults: (sessionId) => api.get(`/tests/session/${sessionId}/results`),

    // Get all completed sessions for review
    getCompletedSessions: () => api.get('/tests/sessions')
};

// Upload API
export const uploadAPI = {
    // Upload and parse PDF
    uploadPDF: (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post('/upload/pdf', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    // Get upload processing status
    getUploadStatus: (jobId) => api.get(`/upload/status/${jobId}`)
};

// Test API
export const testAPI = {
    // Create test session
    createSession: (sessionId, category, questionCount) => {
        return api.post('/tests', {
            sessionId,
            category,
            questionCount
        });
    },

    // Submit test results
    submitResults: (sessionId, results) => {
        return api.post(`/tests/${sessionId}/submit`, { results });
    },

    // Get test results
    getResults: (sessionId) => {
        return api.get(`/tests/${sessionId}/results`);
    },

    // Get all test sessions
    getAllSessions: () => api.get('/tests')
};

// Practice API (AI-powered)
export const practiceAPI = {
    // Generate a random SAT question
    generateQuestion: (category = 'random') => api.post('/practice/generate', { category }),

    // Check user's answer
    checkAnswer: (questionId, question, userAnswer) => api.post('/practice/check', { questionId, question, userAnswer }),

    // Get detailed explanation
    explainAnswer: (questionId, question, userAnswer) => api.post('/practice/explain', { questionId, question, userAnswer }),

    // Get practice history
    getHistory: (limit = 50) => api.get('/practice/history', { params: { limit } }),

    // Get practice stats
    getStats: () => api.get('/practice/stats')
};

export default api;
