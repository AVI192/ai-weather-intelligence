import Groq from 'groq-sdk';
import dotenv from 'dotenv';

/**
 * Service to interface with Groq's high-speed LLM inference engine.
 * Supports live meteorological decision synthesis and interactive weather copilot chat.
 */

export const getActiveModel = () => {
  dotenv.config();
  return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
};
const FALLBACK_MODEL = 'qwen/qwen3.8-27b';

export const getGroqClient = (apiKeyOverride = null) => {
  dotenv.config();
  const apiKey = (apiKeyOverride && String(apiKeyOverride).trim()) || process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('replace_with_your')) {
    return null;
  }
  return new Groq({ apiKey: apiKey.trim() });
};

export const isGroqConfigured = (apiKeyOverride = null) => {
  return Boolean(getGroqClient(apiKeyOverride));
};

/**
 * Synthesizes multi-agent telemetry and generates a live LLM executive insight.
 */
export const generateGroqInsight = async ({
  query = '',
  location = {},
  current = {},
  forecast: _forecast = null,
  risks = null,
  trends = null,
  activityDecision = null,
  reasoning = null
}, apiKeyOverride = null) => {
  const client = getGroqClient(apiKeyOverride);

  // If no Groq API Key is configured, return an intelligent local fallback
  if (!client) {
    return generateLocalFallbackInsight({
      query,
      location,
      current,
      risks,
      trends,
      activityDecision,
      reasoning
    });
  }

  const model = getActiveModel();

  const promptTelemetry = {
    userQuery: query,
    city: location.cityName || current.cityName || 'Current Location',
    country: location.country || current.country || '',
    temperature: current.temperatureCelsius ?? current.temperature,
    feelsLike: current.feelsLikeCelsius ?? current.feelsLike,
    humidity: current.humidityPercent ?? current.humidity,
    windSpeedKmh: current.windSpeedKmh ?? current.windSpeed,
    uvIndex: current.uvIndex,
    condition: current.condition || current.weatherCondition,
    description: current.description || current.weatherDescription,
    rainProbability: current.rainProbability,
    overallRisk: risks?.overallRisk?.level || 'UNKNOWN',
    riskScore: risks?.overallRisk?.score ?? null,
    heatRisk: risks?.risks?.heat?.level,
    uvRisk: risks?.risks?.uv?.level,
    rainRisk: risks?.risks?.rain?.level,
    windRisk: risks?.risks?.wind?.level,
    trendDirection: trends?.overallTrend?.level || 'STABLE',
    trendSummary: trends?.overallTrend?.reason || '',
    activitySuitability: activityDecision?.suitability?.classification || 'MODERATE',
    suitabilityScore: activityDecision?.suitability?.score ?? null,
    favorableFactors: activityDecision?.factors?.positive || [],
    cautionFactors: activityDecision?.factors?.negative || [],
    thermalComfort: reasoning?.thermalComfort?.comfortLevel || 'MODERATE'
  };

  const systemPrompt = `You are WeatherPulse Live AI, an autonomous meteorological intelligence and decision support agent powered by Groq.
Your task is to analyze real-time atmospheric sensor data and multi-agent risk calculations to produce an authoritative, actionable, and user-centric evaluation.

Strict Guidelines:
1. Ground your analysis firmly in the provided telemetry (temperatures, risks, UV, trend direction, humidity).
2. Answer the user's specific query directly and decisively.
3. Be concise, engaging, and professional.
4. Output MUST be valid, well-formed JSON matching the required schema exactly. Do NOT wrap in markdown code blocks or backticks.

Output JSON Schema:
{
  "executiveVerdict": "Clear 1-2 sentence verdict directly answering the query with rationale",
  "optimalTimeWindow": "Specific advised hours today (e.g. '06:30 - 09:00 AM before heat & UV spike' or 'After 17:00 as temperatures cool')",
  "gearAndClothing": ["Specific recommended clothing or equipment 1", "Item 2", "Item 3"],
  "healthAndSafetyTips": ["Actionable physical health or hydration precaution 1", "Precaution 2"],
  "comfortInsight": "One concise sentence on bio-thermal sensation and physiological comfort"
}`;

  const userPrompt = `Real-time Telemetry Data:\n${JSON.stringify(promptTelemetry, null, 2)}\n\nUser Question: "${query || 'Provide an executive weather analysis'}"\n\nGenerate the JSON evaluation:`;

  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' }
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content?.trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Clean possible stray markdown
      const cleaned = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const normalizeList = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) {
        return val.split(/\n|•|,/).map(s => s.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
      }
      return [];
    };

    return {
      success: true,
      isLiveGroq: true,
      provider: 'Groq',
      model: response.model || model,
      latencyMs,
      executiveVerdict: parsed.executiveVerdict || 'Conditions evaluated with live Groq AI inference.',
      optimalTimeWindow: parsed.optimalTimeWindow || 'Review current hourly conditions before heading out.',
      gearAndClothing: normalizeList(parsed.gearAndClothing),
      healthAndSafetyTips: normalizeList(parsed.healthAndSafetyTips),
      comfortInsight: parsed.comfortInsight || 'Thermal conditions monitored in real time.'
    };
  } catch (err) {
    console.warn(`Groq API error on model ${model}:`, err.message);

    // Try fallback model if available
    if (model !== FALLBACK_MODEL) {
      try {
        const fallbackResponse = await client.chat.completions.create({
          model: FALLBACK_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: 'json_object' }
        });
        const latencyMs = Date.now() - startTime;
        const parsed = JSON.parse(fallbackResponse.choices[0]?.message?.content?.trim() || '{}');
        const normalizeList = (val) => {
          if (Array.isArray(val)) return val;
          if (typeof val === 'string' && val.trim()) {
            return val.split(/\n|•|,/).map(s => s.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
          }
          return [];
        };
        return {
          success: true,
          isLiveGroq: true,
          provider: 'Groq',
          model: fallbackResponse.model || FALLBACK_MODEL,
          latencyMs,
          executiveVerdict: parsed.executiveVerdict || 'Evaluated via Groq fallback model.',
          optimalTimeWindow: parsed.optimalTimeWindow || 'Monitor upcoming forecast intervals.',
          gearAndClothing: normalizeList(parsed.gearAndClothing),
          healthAndSafetyTips: normalizeList(parsed.healthAndSafetyTips),
        };
      } catch (fallbackErr) {
        console.warn('Groq fallback attempt also failed:', fallbackErr.message);
      }
    }

    // Return graceful local fallback if network/rate limit issues occur
    const local = generateLocalFallbackInsight({
      query,
      location,
      current,
      risks,
      trends,
      activityDecision,
      reasoning
    });
    return {
      ...local,
      errorNotice: `Groq live call failed (${err.message}). Displaying synthesized agent intelligence.`
    };
  }
};

/**
 * Handles conversational multi-turn chat with Groq Weather Assistant.
 */
export const chatWithGroqWeatherAssistant = async ({
  message = '',
  conversationHistory = [],
  weatherContext = null
}, apiKeyOverride = null) => {
  const client = getGroqClient(apiKeyOverride);

  if (!client) {
    return {
      success: false,
      isLiveGroq: false,
      message: 'Groq API Key is not configured. Add GROQ_API_KEY in your backend/.env file to enable live Groq LLM reasoning.',
      reply: `I can see your weather data for ${weatherContext?.cityName || 'your city'} (${weatherContext?.temperature ?? '--'}°C, ${weatherContext?.weatherCondition || 'clear'}), but live Groq conversation requires a GROQ_API_KEY in backend/.env. Please configure your key to chat freely!`
    };
  }

  const model = getActiveModel();

  const systemMessage = {
    role: 'system',
    content: `You are the WeatherPulse AI Assistant, an elite, friendly, and deeply knowledgeable meteorological expert powered by Groq's ultra-fast LLaMA 3.3.
You have access to live meteorological telemetry and multi-agent risk calculations:
${weatherContext ? JSON.stringify(weatherContext, null, 2) : 'No specific telemetry available; assist using general meteorological wisdom.'}

Your goals:
1. Provide accurate, practical, and punchy advice regarding outdoor activities, commute safety, outfit/packing tips, and forward trends.
2. If the user asks whether an activity is safe, cite specific metrics (e.g. UV, temperature, wind, humidity, rain chance) from the telemetry.
3. Keep responses conversational, concise (2-4 paragraphs max), and actionable. Use bullet points where appropriate.`
  };

  const messages = [
    systemMessage,
    ...conversationHistory.slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: message }
  ];

  const startTime = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 1500
    });

    const latencyMs = Date.now() - startTime;
    const reply = completion.choices[0]?.message?.content?.trim() || 'No response generated.';

    return {
      success: true,
      isLiveGroq: true,
      provider: 'Groq',
      model: completion.model || model,
      latencyMs,
      reply
    };
  } catch (err) {
    console.error('Groq chat error:', err);
    return {
      success: false,
      isLiveGroq: false,
      error: err.message,
      reply: `Encountered an issue querying Groq AI (${err.message}). Please verify your GROQ_API_KEY and connection.`
    };
  }
};

/**
 * Intelligent deterministic synthesizer when GROQ_API_KEY is omitted.
 */
function generateLocalFallbackInsight({
  query: _query,
  location,
  current,
  risks,
  trends,
  activityDecision,
  reasoning
}) {
  const city = location?.cityName || current?.cityName || 'your location';
  const temp = Math.round(current?.temperatureCelsius ?? current?.temperature ?? 24);
  const condition = current?.condition || current?.weatherCondition || 'Fair';
  const suitability = activityDecision?.suitability?.classification || 'MODERATE';
  const riskLevel = risks?.overallRisk?.level || 'LOW';
  const trend = trends?.overallTrend?.level || 'STABLE';
  const uv = current?.uvIndex ?? 5;

  const clothes = [];
  if (temp >= 28) clothes.push('Lightweight, breathable cotton or athletic fabrics');
  else if (temp <= 15) clothes.push('Layered jacket, fleece, or windbreaker');
  else clothes.push('Comfortable everyday casual layers');

  if (uv >= 6) clothes.push('UV-blocking sunglasses & broad-spectrum SPF 30+');
  if (current?.windSpeedKmh > 25) clothes.push('Wind-resistant outer shell');
  if (current?.rainProbability > 0.3 || condition.toLowerCase().includes('rain')) {
    clothes.push('Waterproof jacket or compact umbrella');
  }

  const tips = [];
  if (uv >= 6) tips.push('Minimize unprotected sun exposure during midday peak (11:00 AM - 3:00 PM).');
  if (temp >= 30) tips.push('Increase fluid intake by at least 500ml per hour of moderate exertion.');
  if (trend === 'WORSENING') tips.push('Forward trajectory shows deteriorating weather; complete outdoor tasks early.');
  if (tips.length === 0) tips.push('Conditions are stable; maintain standard hydration and situational awareness.');

  let timeWindow = 'Early morning (06:30 - 09:30 AM) or late afternoon';
  if (trend === 'WORSENING') timeWindow = 'Immediate window: Next 2 hours before conditions worsen';
  else if (trend === 'IMPROVING') timeWindow = 'Later afternoon / early evening as conditions improve';

  return {
    success: true,
    isLiveGroq: false,
    provider: 'Rule Synthesizer (Add GROQ_API_KEY for Live Groq LLaMA 3.3)',
    model: 'synthesizer-heuristic-v1',
    latencyMs: 1,
    executiveVerdict: activityDecision?.decision?.recommendation || `Conditions in ${city} are currently ${condition.toLowerCase()} at ${temp}°C, rated ${suitability} for outdoor activities with ${riskLevel.toLowerCase()} environmental risk.`,
    optimalTimeWindow: timeWindow,
    gearAndClothing: clothes,
    healthAndSafetyTips: tips,
    comfortInsight: reasoning?.summary || `Feels like ${Math.round(current?.feelsLikeCelsius ?? temp)}°C with ${current?.humidityPercent ?? 50}% relative humidity.`
  };
}
