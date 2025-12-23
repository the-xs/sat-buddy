import Dexie from 'dexie';

// Initialize Dexie database
export const db = new Dexie('SATBuddyDB');

// Define database schema
db.version(1).stores({
  questions: '++id, category, questionText, options, correctAnswer, explanation',
  testResults: '++id, questionId, userAnswer, isCorrect, timestamp, testSessionId'
});

// Database operations for questions
export const questionOperations = {
  // Add a single question
  async addQuestion(question) {
    try {
      const id = await db.questions.add(question);
      return { success: true, id };
    } catch (error) {
      console.error('Error adding question:', error);
      return { success: false, error: error.message };
    }
  },

  // Add multiple questions (bulk insert)
  async addQuestions(questions) {
    try {
      await db.questions.bulkAdd(questions);
      return { success: true, count: questions.length };
    } catch (error) {
      console.error('Error adding questions:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all questions
  async getAllQuestions() {
    try {
      const questions = await db.questions.toArray();
      return questions;
    } catch (error) {
      console.error('Error fetching questions:', error);
      return [];
    }
  },

  // Get questions by category
  async getQuestionsByCategory(category) {
    try {
      const questions = await db.questions
        .where('category')
        .equals(category)
        .toArray();
      return questions;
    } catch (error) {
      console.error('Error fetching questions by category:', error);
      return [];
    }
  },

  // Get random questions for test
  async getRandomQuestions(category, count) {
    try {
      let questions;
      if (category === 'all') {
        questions = await db.questions.toArray();
      } else {
        questions = await db.questions
          .where('category')
          .equals(category)
          .toArray();
      }
      
      // Shuffle and return requested count
      const shuffled = questions.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));
    } catch (error) {
      console.error('Error fetching random questions:', error);
      return [];
    }
  },

  // Update a question
  async updateQuestion(id, updates) {
    try {
      await db.questions.update(id, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating question:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete a question
  async deleteQuestion(id) {
    try {
      await db.questions.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting question:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete all questions
  async deleteAllQuestions() {
    try {
      await db.questions.clear();
      return { success: true };
    } catch (error) {
      console.error('Error clearing questions:', error);
      return { success: false, error: error.message };
    }
  },

  // Get question count by category
  async getQuestionCount(category = null) {
    try {
      if (category) {
        return await db.questions.where('category').equals(category).count();
      }
      return await db.questions.count();
    } catch (error) {
      console.error('Error counting questions:', error);
      return 0;
    }
  }
};

// Database operations for test results
export const testResultOperations = {
  // Save test results
  async saveTestResults(results, testSessionId) {
    try {
      const timestamp = new Date().toISOString();
      const resultsWithMetadata = results.map(result => ({
        ...result,
        timestamp,
        testSessionId
      }));
      
      await db.testResults.bulkAdd(resultsWithMetadata);
      return { success: true, testSessionId };
    } catch (error) {
      console.error('Error saving test results:', error);
      return { success: false, error: error.message };
    }
  },

  // Get results for a specific test session
  async getTestResults(testSessionId) {
    try {
      const results = await db.testResults
        .where('testSessionId')
        .equals(testSessionId)
        .toArray();
      return results;
    } catch (error) {
      console.error('Error fetching test results:', error);
      return [];
    }
  },

  // Get all test sessions
  async getAllTestSessions() {
    try {
      const results = await db.testResults.toArray();
      // Group by testSessionId
      const sessions = {};
      results.forEach(result => {
        if (!sessions[result.testSessionId]) {
          sessions[result.testSessionId] = {
            sessionId: result.testSessionId,
            timestamp: result.timestamp,
            results: []
          };
        }
        sessions[result.testSessionId].results.push(result);
      });
      return Object.values(sessions);
    } catch (error) {
      console.error('Error fetching test sessions:', error);
      return [];
    }
  },

  // Delete test results
  async deleteTestResults(testSessionId) {
    try {
      await db.testResults
        .where('testSessionId')
        .equals(testSessionId)
        .delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting test results:', error);
      return { success: false, error: error.message };
    }
  },

  // Clear all test results
  async clearAllResults() {
    try {
      await db.testResults.clear();
      return { success: true };
    } catch (error) {
      console.error('Error clearing test results:', error);
      return { success: false, error: error.message };
    }
  }
};

export default db;
