import { Router } from 'express';
import {
  isGroqConfigured,
  generateGroqInsight,
  chatWithGroqWeatherAssistant,
  getActiveModel
} from '../services/groqService.js';

const router = Router();

/**
 * GET /api/llm/status
 * Check whether Groq LLM is configured on the backend server.
 */
router.get('/status', (req, res) => {
  const customKey = req.headers['x-groq-api-key'];
  const hasKey = isGroqConfigured(customKey);
  const model = getActiveModel();

  res.json({
    success: true,
    configured: hasKey,
    model,
    provider: 'Groq',
    message: hasKey
      ? `Groq LLM is active and ready with model ${model}`
      : 'Groq API Key is not set in backend/.env. Running with heuristic fallback.'
  });
});

/**
 * POST /api/llm/chat
 * Multi-turn live chat with Groq Weather Assistant.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], weatherContext = null, apiKey } = req.body;
    const headerKey = req.headers['x-groq-api-key'];
    const activeKey = apiKey || headerKey || null;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid message string is required.'
      });
    }

    const result = await chatWithGroqWeatherAssistant({
      message: message.trim(),
      conversationHistory,
      weatherContext
    }, activeKey);

    res.json(result);
  } catch (error) {
    console.error('LLM Chat route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chat query with Groq LLM.',
      error: error.message
    });
  }
});

/**
 * POST /api/llm/insight
 * Generate standalone live Groq insight for weather telemetry.
 */
router.post('/insight', async (req, res) => {
  try {
    const { query, location, current, forecast, risks, trends, activityDecision, reasoning, apiKey } = req.body;
    const headerKey = req.headers['x-groq-api-key'];
    const activeKey = apiKey || headerKey || null;

    const result = await generateGroqInsight({
      query,
      location,
      current,
      forecast,
      risks,
      trends,
      activityDecision,
      reasoning
    }, activeKey);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('LLM Insight route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Groq insight.',
      error: error.message
    });
  }
});

export default router;
