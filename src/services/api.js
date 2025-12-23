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

// Upload API
export const uploadAPI = {
    // Upload PDF file
    uploadPDF: (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post('/upload/pdf', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
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

export default api;
