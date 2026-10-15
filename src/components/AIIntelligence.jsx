import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  LoaderCircle,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  Sun,
  CloudRain,
  Wind,
  Eye,
  Activity,
  Sparkles,
  Copy,
  Check,
  MapPin,
  Layers,
  Code,
  Compass,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  ChevronRight,
  Bot,
  Zap,
  Send,
  Key,
  MessageSquare,
  Shirt,
  HeartPulse,
  RefreshCw
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const SUGGESTED_QUERIES = [
  { label: '🏃 Running suitability', query: 'Should I go running today?' },
  { label: '🚴 Cycling conditions', query: 'Is it safe for cycling this afternoon?' },
  { label: '🏊 Outdoor swimming', query: 'Is it suitable for outdoor swimming?' },
  { label: '☕ Outdoor dining', query: 'Will it rain during outdoor dining tonight?' },
  { label: '🚗 Driving safety', query: 'Are road conditions safe for driving?' },
  { label: '🏙️ City comparison', query: 'Compare London and Paris for sightseeing' }
];

export default function AIIntelligence({
  weatherData,
  recentSearches = [],
  onSelectCity,
  onClearHistory,
  activeCity = ''
}) {
  const [query, setQuery] = useState('Should I go running today?');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'copilot' | 'audit' | 'cities'
  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Groq API Key & Status State
  const [groqApiKey, setGroqApiKey] = useState(() => {
    try {
      return localStorage.getItem('weather_groq_api_key') || '';
    } catch {
      return '';
    }
  });
  const [groqStatus, setGroqStatus] = useState({ configured: false, model: 'llama-3.3-70b-versatile' });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [keySavedToast, setKeySavedToast] = useState(false);

  // Live Copilot Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm your Live Weather AI Copilot, powered by Groq's ultra-fast LLaMA 3.3. Ask me anything about current conditions, outfit planning, best activity times, or safety recommendations!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'llama-3.3-70b-versatile',
      isLive: true
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatBottomRef = useRef(null);

  // Check Groq status on mount and when key changes
  useEffect(() => {
    const checkGroq = async () => {
      try {
        const headers = groqApiKey ? { 'x-groq-api-key': groqApiKey } : {};
        const res = await fetch(`${API_BASE}/llm/status`, { headers });
        const json = await res.json();
        if (json.success) {
          setGroqStatus(json);
        }
      } catch {
        // backend might not be ready yet
      }
    };
    checkGroq();
  }, [groqApiKey]);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    setGroqApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('weather_groq_api_key', trimmed);
      } else {
        localStorage.removeItem('weather_groq_api_key');
      }
    } catch {
      // storage unavailable
    }
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 2500);
    setShowApiKeyModal(false);
  };

  const runAnalysis = async (customQuery) => {
    const activePrompt = typeof customQuery === 'string' ? customQuery : query;
    if (!activePrompt.trim()) return;

    setBusy(true);
    setError('');

    try {
      const params = new URLSearchParams({ query: activePrompt });
      const lat = Number.isFinite(weatherData?.coord?.lat) ? weatherData.coord.lat : 18.5204;
      const lon = Number.isFinite(weatherData?.coord?.lon) ? weatherData.coord.lon : 73.8567;
      params.set('lat', String(lat));
      params.set('lon', String(lon));

      const headers = {};
      if (groqApiKey) {
        headers['x-groq-api-key'] = groqApiKey;
      }

      const response = await fetch(`${API_BASE}/orchestrator/execute?${params.toString()}`, {
        headers
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('Backend returned an unparseable response.');
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || 'The AI orchestrator could not complete this analysis.');
      }

      const data = payload.data ?? payload;
      setResult(data);

      // Auto-switch to relevant tab if special response
      if (data?.cityResult) {
        setActiveTab('cities');
      } else if (data?.status === 'insufficient_data') {
        setActiveTab('audit');
      }
    } catch (err) {
      setError(err?.message || 'Unable to connect to the AI weather backend. Make sure the server is running on port 5000.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChatMessage = async (customMessage) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : chatInput;
    if (!textToSend.trim() || chatBusy) return;

    const userMsg = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatBusy(true);

    try {
      const weatherContext = {
        cityName: result?.normalizedData?.current?.cityName || activeCity || weatherData?.cityName || 'Current City',
        temperature: result?.normalizedData?.current?.temperature ?? weatherData?.temperature,
        feelsLike: result?.normalizedData?.current?.feelsLike ?? weatherData?.feelsLike,
        weatherCondition: result?.normalizedData?.current?.weatherCondition ?? weatherData?.weatherCondition,
        humidity: result?.normalizedData?.current?.humidity ?? weatherData?.humidity,
        windSpeed: result?.normalizedData?.current?.windSpeed ?? weatherData?.windSpeed,
        uvIndex: result?.normalizedData?.current?.uvIndex ?? weatherData?.uvIndex,
        overallRisk: result?.riskResult?.overallRisk?.level,
        riskScore: result?.riskResult?.overallRisk?.score,
        suitabilityScore: result?.activityDecision?.suitability?.score,
        suitabilityClass: result?.activityDecision?.suitability?.classification,
        trend: result?.trendResult?.overallTrend?.level
      };

      const headers = { 'Content-Type': 'application/json' };
      if (groqApiKey) {
        headers['x-groq-api-key'] = groqApiKey;
      }

      const res = await fetch(`${API_BASE}/llm/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend.trim(),
          conversationHistory: chatMessages.slice(-6),
          weatherContext
        })
      });

      const data = await res.json();

      const assistantMsg = {
        role: 'assistant',
        content: data.reply || (data.message ? `Error: ${data.message}` : 'No response from AI assistant.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || groqStatus.model || 'llama-3.3-70b-versatile',
        latencyMs: data.latencyMs,
        isLive: Boolean(data.isLiveGroq)
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${err.message}. Ensure backend is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setChatBusy(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    const initialPrompt = activeCity ? `Should I go running in ${activeCity}?` : 'Should I go running today?';
    setQuery(initialPrompt);
    runAnalysis(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    runAnalysis();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runAnalysis();
    }
  };

  const handleSelectSuggested = (promptText) => {
    setQuery(promptText);
    runAnalysis(promptText);
  };

  const handleCopyVerdict = () => {
    if (!result) return;
    const textToCopy =
      result?.activityDecision?.decision?.recommendation ||
      result?.riskResult?.decision?.recommendation ||
      result?.reasoningResult?.summary ||
      result?.message ||
      'AI Analysis completed.';

    navigator.clipboard?.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard?.writeText(JSON.stringify(result, null, 2)).then(() => {
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2200);
    });
  };

  // Active extracted components
  const activityData = result?.activityDecision;
  const riskData = result?.riskResult;
  const trendData = result?.trendResult;
  const qualityData = result?.dataQuality;
  const checksData = result?.checks || [];
  const cityData = result?.cityResult;
  const normalizedCurrent = result?.normalizedData?.current;

  // --------------------------------------------------------------------------
  // Evidence-based Verdict State Calculation
  // --------------------------------------------------------------------------
  let verdictState = 'favorable'; // 'favorable' | 'caution' | 'unfavorable' | 'insufficient-data'
  let verdictTitle = 'Favorable Conditions';
  let trajectoryNote = null;

  const suitabilityScore = activityData?.suitability?.score;
  const suitabilityClass = activityData?.suitability?.classification;
  const overallRiskLevel = riskData?.overallRisk?.level;
  const trendLevel = trendData?.overallTrend?.level;

  if (result?.status === 'insufficient_data' || qualityData?.status === 'INSUFFICIENT' || result?.success === false) {
    verdictState = 'insufficient-data';
    verdictTitle = 'Insufficient Telemetry';
  } else if (activityData?.suitability) {
    const isFavorableCurrent = suitabilityScore >= 65 && overallRiskLevel !== 'HIGH' && overallRiskLevel !== 'VERY HIGH';
    const isWorseningTrend = trendLevel === 'WORSENING';
    const isImprovingTrend = trendLevel === 'IMPROVING';

    if (isFavorableCurrent) {
      if (isWorseningTrend) {
        // Current is favorable but forward forecast deteriorates
        verdictState = 'caution';
        verdictTitle = 'Favorable Now • Deteriorating Ahead';
        const shiftReason = trendData?.keyChanges?.[0]?.description || 'weather deterioration in forward forecast intervals';
        trajectoryNote = `Current conditions are favorable (${suitabilityClass}, score ${suitabilityScore}/100), but the forecast indicates deterioration later (${shiftReason}). Plan outdoor activities promptly or monitor incoming shifts.`;
      } else {
        verdictState = 'favorable';
        verdictTitle = suitabilityClass === 'EXCELLENT' ? 'Optimal Outdoor Conditions' : 'Favorable Conditions';
      }
    } else if (suitabilityScore >= 45 && suitabilityScore < 65) {
      verdictState = 'caution';
      verdictTitle = 'Moderate Conditions • Caution Advised';
      if (isImprovingTrend) {
        const shiftReason = trendData?.keyChanges?.[0]?.description || 'forward conditions projected to improve';
        trajectoryNote = `Current conditions are moderate (${suitabilityClass}, score ${suitabilityScore}/100), but the forward trajectory indicates improvement ahead (${shiftReason}).`;
      }
    } else {
      // Unfavorable (< 45 or high risk)
      verdictState = 'unfavorable';
      verdictTitle = overallRiskLevel === 'VERY HIGH' || overallRiskLevel === 'HIGH'
        ? 'High Risk • Unfavorable Conditions'
        : 'Unfavorable Conditions';
      if (isImprovingTrend) {
        const shiftReason = trendData?.keyChanges?.[0]?.description || 'conditions projected to ease later';
        trajectoryNote = `Current conditions are unsuitable (${suitabilityClass || 'Unsuitable'}, score ${suitabilityScore ?? 0}/100), but forward trends show gradual improvement ahead (${shiftReason}).`;
      }
    }
  } else if (riskData?.overallRisk) {
    // Non-activity general query
    if (overallRiskLevel === 'LOW') {
      if (trendLevel === 'WORSENING') {
        verdictState = 'caution';
        verdictTitle = 'Low Current Hazard • Worsening Trend';
        trajectoryNote = 'Current environmental risk is low, but the forward trajectory indicates deteriorating atmospheric conditions.';
      } else {
        verdictState = 'favorable';
        verdictTitle = 'Low Environmental Hazard';
      }
    } else if (overallRiskLevel === 'MODERATE') {
      verdictState = 'caution';
      verdictTitle = 'Moderate Environmental Hazard';
    } else {
      verdictState = 'unfavorable';
      verdictTitle = 'Elevated Environmental Risk';
    }
  }

  const heroRecommendation =
    activityData?.decision?.recommendation ||
    riskData?.decision?.recommendation ||
    result?.reasoningResult?.summary ||
    result?.message ||
    (verdictState === 'insufficient-data'
      ? 'Weather sensor telemetry is incomplete or corrupt for reliable AI decisions.'
      : 'AI Multi-Agent evaluation completed.');

  const getSuitabilityColor = (classification) => {
    switch (classification) {
      case 'EXCELLENT':
        return { cls: 'suitability-pill-excellent', color: '#10b981', label: 'Excellent' };
      case 'GOOD':
        return { cls: 'suitability-pill-good', color: '#38bdf8', label: 'Good' };
      case 'MODERATE':
        return { cls: 'suitability-pill-moderate', color: '#f59e0b', label: 'Moderate' };
      case 'POOR':
        return { cls: 'suitability-pill-poor', color: '#f97316', label: 'Poor' };
      case 'UNSUITABLE':
        return { cls: 'suitability-pill-unsuitable', color: '#ef4444', label: 'Unsuitable' };
      default:
        return { cls: 'suitability-pill-neutral', color: '#94a3b8', label: classification || 'Analyzed' };
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'LOW':
        return { cls: 'risk-pill-low', color: '#10b981', text: 'Low' };
      case 'MODERATE':
        return { cls: 'risk-pill-mod', color: '#f59e0b', text: 'Moderate' };
      case 'HIGH':
        return { cls: 'risk-pill-high', color: '#f97316', text: 'High' };
      case 'VERY HIGH':
        return { cls: 'risk-pill-vhigh', color: '#ef4444', text: 'Very High' };
      default:
        return { cls: 'risk-pill-neutral', color: '#94a3b8', text: level || 'Unknown' };
    }
  };

  const getTrendIcon = (level) => {
    switch (level) {
      case 'IMPROVING':
        return <TrendingUp className="trend-icon-improving" size={20} />;
      case 'WORSENING':
        return <TrendingDown className="trend-icon-worsening" size={20} />;
      default:
        return <Minus className="trend-icon-stable" size={20} />;
    }
  };

  const suitabilityMeta = activityData?.suitability
    ? getSuitabilityColor(activityData.suitability.classification)
    : null;

  const currentDisplayCity =
    normalizedCurrent?.cityName ||
    activeCity ||
    weatherData?.cityName ||
    '';

  const currentCoordinates =
    normalizedCurrent?.coordinates?.latitude && normalizedCurrent?.coordinates?.longitude
      ? `${Number(normalizedCurrent.coordinates.latitude).toFixed(2)}°, ${Number(normalizedCurrent.coordinates.longitude).toFixed(2)}°`
      : weatherData?.coord?.lat && weatherData?.coord?.lon
      ? `${Number(weatherData.coord.lat).toFixed(2)}°, ${Number(weatherData.coord.lon).toFixed(2)}°`
      : null;

  return (
    <section className="ai-intelligence-page" aria-label="AI Weather Intelligence">
      {/* 1. TOP UTILITY: Recent Searches Bar */}
      {recentSearches && recentSearches.length > 0 && (
        <div className="ai-recent-searches-bar">
          <div className="ai-recent-left">
            <Clock size={14} className="ai-recent-icon" />
            <span className="ai-recent-label">Recent:</span>
            <div className="ai-recent-chips">
              {recentSearches.slice(0, 6).map((city, idx) => {
                const isActive = activeCity && activeCity.toLowerCase() === city.toLowerCase();
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`ai-recent-chip ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectCity && onSelectCity(city)}
                    title={`Load weather for ${city}`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {onClearHistory && (
            <button
              type="button"
              className="ai-clear-history-btn"
              onClick={onClearHistory}
              title="Clear search history"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      )}

      {/* 2. AI Intelligence Hero Header */}
      <div className="ai-hero-header">
        <div className="ai-hero-title-group">
          <div className="ai-hero-icon-bubble">
            <BrainCircuit size={28} />
          </div>
          <div className="ai-hero-text">
            <div className="ai-hero-badge">
              <Sparkles size={13} />
              <span>Multi-Agent Neural Weather Intelligence</span>
            </div>
            <h2>AI Weather Intelligence</h2>
            <p>
              Ask natural-language questions about your activities, plans, and travel safety. Autonomous agents
              validate sensor integrity, quantify multi-dimensional risk vectors, and project forward trends.
            </p>
          </div>
        </div>

        {/* Active Location Indicator */}
        <div className="ai-location-indicator">
          <MapPin size={16} className="text-cyan" />
          <span className="ai-location-text">
            {currentDisplayCity ? (
              <>
                Active Location: <strong>{currentDisplayCity}</strong>
                {currentCoordinates && (
                  <span className="ai-coords-tag">({currentCoordinates})</span>
                )}
              </>
            ) : (
              'No active location selected — search a city above or specify one in your query'
            )}
          </span>
        </div>
      </div>

      {/* 3. Natural Language Analysis Input Panel */}
      <div className="ai-query-panel">
        <form className="ai-intelligence-form" onSubmit={handleSubmit}>
          <div className="ai-textarea-wrapper">
            <textarea
              id="ai-weather-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask anything, e.g., Should I go running today? Is it safe for cycling this afternoon? Compare London and Paris."
              aria-label="Natural-language weather question"
              required
            />
            <button
              type="submit"
              className="ai-run-button"
              disabled={busy || !query.trim()}
              title="Execute AI Multi-Agent analysis (Enter)"
            >
              {busy ? (
                <>
                  <LoaderCircle className="ai-spin" size={18} />
                  <span>Synthesizing…</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Run Analysis</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested Query Chips */}
        <div className="ai-quick-prompts">
          <span className="ai-quick-label">Suggested:</span>
          <div className="ai-chips-list">
            {SUGGESTED_QUERIES.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-chip-btn"
                onClick={() => handleSelectSuggested(sq.query)}
                disabled={busy}
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="ai-message ai-error" role="alert">
          <AlertCircle size={20} className="ai-error-icon" />
          <div className="ai-error-content">
            <strong>Analysis Interrupted</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Loading Spinner Indicator when initial query runs */}
      {busy && !result && (
        <div className="ai-thinking-card">
          <div className="ai-thinking-spinner">
            <LoaderCircle size={36} className="ai-spin" />
          </div>
          <div className="ai-thinking-text">
            <h4>Agents Running Multi-Tier Analysis…</h4>
            <p>Validating telemetry quality, computing compound hazard vectors, and synthesizing recommendations</p>
          </div>
        </div>
      )}

      {/* Empty State when no result exists yet and not loading */}
      {!result && !busy && !error && (
        <div className="ai-empty-prompt-state">
          <BrainCircuit size={40} className="ai-empty-icon" />
          <h3>Autonomous Weather Intelligence Ready</h3>
          <p>Ask about cycling, running, hiking, beach trips, or compare cities to trigger multi-agent analysis.</p>
        </div>
      )}

      {/* 4. Analysis Results Area */}
      {result && (
        <div className={`ai-results-dashboard ${busy ? 'ai-results-refreshing' : ''}`}>
          {/* AI Decision Verdict Card */}
          <div className={`ai-verdict-card verdict-${verdictState}`}>
            <div className="ai-verdict-top">
              <div className="ai-verdict-pill-row">
                <span className="ai-verdict-agent-tag">
                  <BrainCircuit size={14} /> AI Decision Verdict
                </span>

                <span className={`ai-status-pill pill-${verdictState}`}>
                  {verdictState === 'favorable' ? (
                    <CheckCircle2 size={14} />
                  ) : verdictState === 'caution' ? (
                    <AlertTriangle size={14} />
                  ) : verdictState === 'insufficient-data' ? (
                    <AlertCircle size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span>{verdictTitle}</span>
                </span>

                {activityData?.suitability && suitabilityMeta && (
                  <span className={`ai-suitability-pill ${suitabilityMeta.cls}`}>
                    {suitabilityMeta.label} ({activityData.suitability.score}/100)
                  </span>
                )}
              </div>

              <button
                type="button"
                className="ai-copy-btn"
                onClick={handleCopyVerdict}
                title="Copy verdict to clipboard"
              >
                {copied ? <Check size={14} className="copied-check" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Verdict'}</span>
              </button>
            </div>

            <div className="ai-verdict-main">
              <div className="ai-verdict-icon">
                {verdictState === 'favorable' ? (
                  <CheckCircle2 size={36} className="icon-favorable-green" />
                ) : verdictState === 'caution' ? (
                  <AlertTriangle size={36} className="icon-caution-amber" />
                ) : (
                  <AlertCircle size={36} className="icon-unfavorable-red" />
                )}
              </div>
              <div className="ai-verdict-text-block">
                {result?.llmInsight ? (
                  <div className="ai-groq-executive-banner">
                    <div className="ai-groq-header-row">
                      <div className="ai-groq-title-wrap">
                        <div className="ai-groq-pulse-icon">
                          <Zap size={16} />
                        </div>
                        <span className="ai-groq-brand">Groq Live AI • {result.llmInsight.model || 'High-Speed'}</span>
                        {result.llmInsight.isLiveGroq ? (
                          <span className="ai-groq-status-live">
                            <span className="live-dot" />
                            Live Inference {result.llmInsight.latencyMs ? `(${result.llmInsight.latencyMs}ms)` : ''}
                          </span>
                        ) : (
                          <button 
                            type="button" 
                            className="ai-groq-status-fallback"
                            onClick={() => {
                              setApiKeyInput(groqApiKey);
                              setShowApiKeyModal(true);
                            }}
                            title="Click to enter Groq API Key for live LLaMA 3.3"
                          >
                            <Key size={12} />
                            <span>Connect Groq Key</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        className="ai-groq-copilot-shortcut-btn"
                        onClick={() => setActiveTab('copilot')}
                      >
                        <MessageSquare size={14} />
                        <span>Chat Copilot</span>
                      </button>
                    </div>

                    <p className="ai-groq-verdict-text">
                      "{result.llmInsight.executiveVerdict || heroRecommendation}"
                    </p>

                    <div className="ai-groq-highlights-grid">
                      {result.llmInsight.optimalTimeWindow && (
                        <div className="ai-groq-highlight-pill time-pill">
                          <Clock size={15} className="pill-icon" />
                          <div className="pill-content">
                            <span className="pill-title">Optimal Time Window</span>
                            <span className="pill-body">{result.llmInsight.optimalTimeWindow}</span>
                          </div>
                        </div>
                      )}

                      {result.llmInsight.gearAndClothing && result.llmInsight.gearAndClothing.length > 0 && (
                        <div className="ai-groq-highlight-pill gear-pill">
                          <Shirt size={15} className="pill-icon" />
                          <div className="pill-content">
                            <span className="pill-title">Recommended Gear & Attire</span>
                            <span className="pill-body">{result.llmInsight.gearAndClothing.join(' • ')}</span>
                          </div>
                        </div>
                      )}

                      {result.llmInsight.healthAndSafetyTips && result.llmInsight.healthAndSafetyTips.length > 0 && (
                        <div className="ai-groq-highlight-pill health-pill">
                          <HeartPulse size={15} className="pill-icon" />
                          <div className="pill-content">
                            <span className="pill-title">Health & Precaution Advisory</span>
                            <span className="pill-body">{result.llmInsight.healthAndSafetyTips.join(' • ')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="ai-verdict-recommendation">"{heroRecommendation}"</p>
                )}

                {/* Forward Trajectory Distinction Banner */}
                {trajectoryNote && (
                  <div className="ai-trajectory-distinction-banner">
                    <TrendingDown size={16} className="text-amber flex-shrink-0" />
                    <span>{trajectoryNote}</span>
                  </div>
                )}

                {/* Metadata Row: Intent, Activity, Executed Agents */}
                <div className="ai-verdict-metadata-row">
                  {result.intent && (
                    <span className="ai-meta-chip">
                      <strong>Intent:</strong> {String(result.intent).toLowerCase().replace('_', ' ')}
                    </span>
                  )}
                  {result.activity && result.activity !== 'general' && (
                    <span className="ai-meta-chip">
                      <strong>Activity:</strong> {result.activity}
                    </span>
                  )}
                  {result.executedAgents && result.executedAgents.length > 0 ? (
                    <span className="ai-meta-chip">
                      <strong>Executed Agents:</strong> {result.executedAgents.map(a => `${a} (${result.agentStatuses?.[a] || 'completed'})`).join(' • ')}
                    </span>
                  ) : result.executionPlan && result.executionPlan.length > 0 ? (
                    <span className="ai-meta-chip">
                      <strong>Planned Agents:</strong> {result.executionPlan.join(' • ')}
                    </span>
                  ) : null}
                  {result.isPartial && (
                    <span className="ai-meta-chip partial-alert">
                      <strong>Partial Results</strong>
                    </span>
                  )}
                </div>

                {/* Safety limitations notice */}
                {activityData?.safetyLimitations && activityData.safetyLimitations.length > 0 && (
                  <div className="ai-safety-notice-row">
                    <AlertCircle size={14} className="text-amber flex-shrink-0" />
                    <span>{activityData.safetyLimitations[0]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Four Summary Cards */}
          <div className="ai-kpi-grid">
            {/* KPI 1: Suitability Score */}
            <div className="ai-kpi-card">
              <div className="ai-kpi-header">
                <span className="ai-kpi-label">Suitability Score</span>
                <div className="ai-kpi-icon-wrap blue">
                  <Activity size={18} />
                </div>
              </div>
              <div className="ai-kpi-value-row">
                {activityData?.suitability?.score != null ? (
                  <>
                    <span className="ai-kpi-number">{activityData.suitability.score}</span>
                    <span className="ai-kpi-max">/100</span>
                  </>
                ) : (
                  <span className="ai-kpi-number text-muted-sub">Unavailable</span>
                )}
              </div>
              <div className="ai-progress-bar">
                <div
                  className="ai-progress-fill"
                  style={{
                    width: activityData?.suitability?.score != null ? `${activityData.suitability.score}%` : '0%',
                    backgroundColor: suitabilityMeta?.color || '#38bdf8'
                  }}
                />
              </div>
              <div className="ai-kpi-subtext">
                Rating: <strong>{activityData?.suitability?.classification || 'General / Non-activity'}</strong>
              </div>
            </div>

            {/* KPI 2: Overall Risk Level */}
            <div className="ai-kpi-card">
              <div className="ai-kpi-header">
                <span className="ai-kpi-label">Overall Risk Level</span>
                <div className="ai-kpi-icon-wrap amber">
                  <ShieldAlert size={18} />
                </div>
              </div>
              <div className="ai-kpi-value-row">
                {riskData?.overallRisk?.score != null ? (
                  <>
                    <span className="ai-kpi-number">{riskData.overallRisk.score}</span>
                    <span className="ai-kpi-max">/100</span>
                  </>
                ) : (
                  <span className="ai-kpi-number text-muted-sub">Unknown</span>
                )}
              </div>
              <div className="ai-progress-bar">
                <div
                  className="ai-progress-fill"
                  style={{
                    width: riskData?.overallRisk?.score != null ? `${riskData.overallRisk.score}%` : '0%',
                    backgroundColor: riskData?.overallRisk?.level ? getRiskBadge(riskData.overallRisk.level).color : '#10b981'
                  }}
                />
              </div>
              <div className="ai-kpi-subtext">
                Hazard Tier: <strong style={{ color: riskData?.overallRisk?.level ? getRiskBadge(riskData.overallRisk.level).color : 'inherit' }}>
                  {riskData?.overallRisk?.level || 'Unavailable'}
                </strong>
              </div>
            </div>

            {/* KPI 3: Forecast Trajectory */}
            <div className="ai-kpi-card">
              <div className="ai-kpi-header">
                <span className="ai-kpi-label">Forecast Trajectory</span>
                <div className="ai-kpi-icon-wrap purple">
                  {getTrendIcon(trendData?.overallTrend?.level)}
                </div>
              </div>
              <div className="ai-kpi-value-row">
                <span className="ai-kpi-number text-trend-title">
                  {trendData?.overallTrend?.level || 'Unavailable'}
                </span>
              </div>
              <div className="ai-progress-bar">
                <div
                  className="ai-progress-fill"
                  style={{
                    width: trendData?.overallTrend?.level === 'IMPROVING' ? '85%' : trendData?.overallTrend?.level === 'STABLE' ? '50%' : '25%',
                    backgroundColor: trendData?.overallTrend?.level === 'IMPROVING' ? '#10b981' : trendData?.overallTrend?.level === 'STABLE' ? '#38bdf8' : '#f59e0b'
                  }}
                />
              </div>
              <div className="ai-kpi-subtext">
                Horizon: <strong>{trendData?.forecastRecordsAnalyzed || (qualityData?.forecastRecords ?? 40)} pts (5 days)</strong>
              </div>
            </div>

            {/* KPI 4: Telemetry Quality */}
            <div className="ai-kpi-card">
              <div className="ai-kpi-header">
                <span className="ai-kpi-label">Telemetry Quality</span>
                <div className="ai-kpi-icon-wrap green">
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="ai-kpi-value-row">
                {qualityData?.score != null ? (
                  <>
                    <span className="ai-kpi-number">{qualityData.score}%</span>
                    <span className={`ai-kpi-status-badge badge-${(qualityData.status || 'degraded').toLowerCase()}`}>
                      {qualityData.status || 'READY'}
                    </span>
                  </>
                ) : (
                  <span className="ai-kpi-number text-muted-sub">Unavailable</span>
                )}
              </div>
              <div className="ai-progress-bar">
                <div
                  className="ai-progress-fill"
                  style={{
                    width: qualityData?.score != null ? `${qualityData.score}%` : '0%',
                    backgroundColor: qualityData?.status === 'READY' ? '#10b981' : qualityData?.status === 'DEGRADED' ? '#f59e0b' : '#ef4444'
                  }}
                />
              </div>
              <div className="ai-kpi-subtext">
                Integrity: <strong>{qualityData?.validChecks ?? 0} / {qualityData?.totalChecks ?? 0} checks valid</strong>
              </div>
            </div>
          </div>

          {/* 6. Diagnostic Tabs */}
          <div className="ai-tabs-container">
            <div className="ai-tabs-bar" role="tablist" aria-label="Intelligence Views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'radar'}
                className={`ai-tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
                onClick={() => setActiveTab('radar')}
              >
                <ShieldAlert size={16} />
                <span>Risk Radar</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'copilot'}
                className={`ai-tab-btn ai-tab-btn-copilot ${activeTab === 'copilot' ? 'active' : ''}`}
                onClick={() => setActiveTab('copilot')}
              >
                <Zap size={16} className="text-amber-gold" />
                <span>Live Groq Copilot</span>
                <span className="tab-pill-badge live-pulse-badge">Live</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'audit'}
                className={`ai-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <Layers size={16} />
                <span>Data Audit</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'cities'}
                className={`ai-tab-btn ${activeTab === 'cities' ? 'active' : ''}`}
                onClick={() => setActiveTab('cities')}
              >
                <Compass size={16} />
                <span>City Comparison</span>
                {cityData && <span className="tab-pill-badge">{cityData.ranking?.length || 2}</span>}
              </button>
            </div>

            {/* TAB CONTENT PANELS */}
            <div className="ai-tab-content-wrapper">
              {/* TAB 1: Risk Radar */}
              {activeTab === 'radar' && (
                <div className="ai-tab-panel" role="tabpanel">
                  <div className="ai-panel-header">
                    <h3>🛡️ Multi-Factor Environmental Risk Assessment</h3>
                    <p>Calculated across 5 primary meteorological risk vectors and cross-parameter interactions</p>
                  </div>

                  <div className="ai-risk-meters-grid">
                    {[
                      { key: 'heat', title: 'Heat & Thermal Stress', icon: <Thermometer size={18} />, data: riskData?.risks?.heat },
                      { key: 'uv', title: 'UV Solar Radiation', icon: <Sun size={18} />, data: riskData?.risks?.uv },
                      { key: 'rain', title: 'Precipitation & Rain', icon: <CloudRain size={18} />, data: riskData?.risks?.rain },
                      { key: 'wind', title: 'Wind & Gust Velocity', icon: <Wind size={18} />, data: riskData?.risks?.wind },
                      { key: 'visibility', title: 'Atmospheric Visibility', icon: <Eye size={18} />, data: riskData?.risks?.visibility }
                    ].map(({ key, title, icon, data }) => {
                      const score = data?.score != null ? data.score : null;
                      const level = data?.level || 'UNKNOWN';
                      const badge = getRiskBadge(level);

                      return (
                        <div key={key} className="ai-risk-meter-box">
                          <div className="ai-risk-meter-header">
                            <div className="ai-risk-title-with-icon">
                              <span className="risk-type-icon">{icon}</span>
                              <span className="risk-type-name">{title}</span>
                            </div>
                            <span className={`risk-level-tag ${badge.cls}`}>
                              {badge.text}
                            </span>
                          </div>

                          <div className="ai-risk-meter-bar-row">
                            <div className="ai-risk-meter-track">
                              <div
                                className="ai-risk-meter-fill"
                                style={{
                                  width: score != null ? `${Math.min(Math.max(score, 4), 100)}%` : '0%',
                                  backgroundColor: badge.color
                                }}
                              />
                            </div>
                            <span className="ai-risk-meter-score">
                              {score != null ? `${score} / 100` : 'Unknown'}
                            </span>
                          </div>

                          <p className="ai-risk-explanation">
                            {data?.explanation || 'No adverse risk conditions reported.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Compound Interactions */}
                  {riskData?.interactions && riskData.interactions.length > 0 && (
                    <div className="ai-interactions-box">
                      <h4>⚠️ Compound Parameter Interactions</h4>
                      <ul className="ai-interactions-list">
                        {riskData.interactions.map((interaction, i) => (
                          <li key={i}>
                            <strong>{interaction.severity || 'NOTE'}:</strong>{' '}
                            {typeof interaction === 'string'
                              ? interaction
                              : interaction.explanation || JSON.stringify(interaction)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Activity Factors Breakdown if present */}
                  {activityData?.factors && (activityData.factors.positive?.length > 0 || activityData.factors.negative?.length > 0) && (
                    <div className="ai-factors-split-grid">
                      <div className="ai-factor-card favorable-factor-card">
                        <div className="ai-factor-header">
                          <CheckCircle2 size={16} className="text-emerald" />
                          <h4>Favorable Indicators</h4>
                        </div>
                        {activityData.factors.positive?.length ? (
                          <ul className="ai-factor-list">
                            {activityData.factors.positive.map((item, idx) => (
                              <li key={idx} className="ai-factor-item">
                                <span className="factor-bullet green">✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-sub">No strong favorable indicators identified.</p>
                        )}
                      </div>

                      <div className="ai-factor-card caution-factor-card">
                        <div className="ai-factor-header">
                          <AlertTriangle size={16} className="text-amber" />
                          <h4>Caution Points</h4>
                        </div>
                        {activityData.factors.negative?.length ? (
                          <ul className="ai-factor-list">
                            {activityData.factors.negative.map((item, idx) => (
                              <li key={idx} className="ai-factor-item">
                                <span className="factor-bullet amber">!</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-sub">No significant cautionary points identified.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Data Audit */}
              {activeTab === 'audit' && (
                <div className="ai-tab-panel" role="tabpanel">
                  <div className="ai-panel-header">
                    <h3>🛡️ Data Intelligence & Sensor Telemetry Verification</h3>
                    <p>Quality gatekeeper validates sensor completeness and values before downstream agent decisions</p>
                  </div>

                  {/* Audit Metric Badges */}
                  <div className="ai-audit-stats-grid">
                    <div className="ai-audit-stat-card">
                      <span className="audit-label">Data Quality Score</span>
                      <span className="audit-value text-emerald">{qualityData?.score ?? 0}%</span>
                      <span className="audit-desc">
                        {qualityData?.score >= 80 ? 'Exceeds 80% AI confidence gate' : 'Below 80% confidence gate'}
                      </span>
                    </div>

                    <div className="ai-audit-stat-card">
                      <span className="audit-label">Validation Checks</span>
                      <span className="audit-value">
                        {qualityData?.validChecks ?? 0} / {qualityData?.totalChecks ?? 0}
                      </span>
                      <span className="audit-desc">Physical bounds & validity verified</span>
                    </div>

                    <div className="ai-audit-stat-card">
                      <span className="audit-label">Forecast Horizon</span>
                      <span className="audit-value">
                        {qualityData?.validForecastRecords ?? qualityData?.forecastRecords ?? 0} pts
                      </span>
                      <span className="audit-desc">Full 5-day / 3-hour coverage</span>
                    </div>

                    <div className="ai-audit-stat-card">
                      <span className="audit-label">Readiness State</span>
                      <span className={`audit-value ${qualityData?.status === 'READY' ? 'text-blue' : 'text-amber'}`}>
                        {qualityData?.status ?? 'UNKNOWN'}
                      </span>
                      <span className="audit-desc">
                        {qualityData?.status === 'READY' ? 'Approved for downstream AI agents' : 'Degraded telemetry alert'}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Input Check List */}
                  {checksData && checksData.length > 0 && (
                    <div className="ai-audit-checks-section">
                      <h4>Input Telemetry Audit Results</h4>
                      <div className="ai-checks-table-wrapper">
                        <table className="ai-checks-table">
                          <thead>
                            <tr>
                              <th>Parameter</th>
                              <th>Status</th>
                              <th>Recorded Value</th>
                              <th>Validation Rule</th>
                            </tr>
                          </thead>
                          <tbody>
                            {checksData.map((chk, i) => (
                              <tr key={i} className={chk.valid ? 'chk-pass' : 'chk-fail'}>
                                <td><strong>{chk.name}</strong></td>
                                <td>
                                  <span className={`ai-chk-pill ${chk.valid ? 'pill-pass' : 'pill-fail'}`}>
                                    {chk.valid ? 'PASSED' : 'FLAGGED'}
                                  </span>
                                </td>
                                <td>
                                  <code>
                                    {chk.value === null || chk.value === undefined
                                      ? 'null / missing'
                                      : typeof chk.value === 'object'
                                      ? JSON.stringify(chk.value)
                                      : String(chk.value)}
                                  </code>
                                </td>
                                <td>{chk.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Multi-City Comparison */}
              {activeTab === 'cities' && (
                <div className="ai-tab-panel" role="tabpanel">
                  <div className="ai-panel-header">
                    <h3>🏙️ Multi-City Suitability Comparison</h3>
                    <p>Rankings and weather suitability for <strong>{cityData?.activity || 'selected activity'}</strong></p>
                  </div>

                  {cityData ? (
                    <>
                      {cityData.winner && (
                        <div className="ai-city-winner-banner">
                          <Sparkles size={24} className="text-gold flex-shrink-0" />
                          <div>
                            <h4>Recommended Destination: {cityData.winner.city}</h4>
                            <p>
                              Suitability: <strong>{cityData.winner.score}/100</strong> ({cityData.winner.classification || 'Top Pick'})
                              {cityData.winner.scoreDifference != null && (
                                <span> • Outperforming rival cities by {cityData.winner.scoreDifference} points</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Desktop / Tablet Comparison Table */}
                      <div className="ai-city-ranks-table-wrapper">
                        <table className="ai-city-ranks-table">
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Destination</th>
                              <th>Suitability Score</th>
                              <th>Rating</th>
                              <th>Risk Tier</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cityData.ranking || []).map((row) => (
                              <tr key={row.rank} className={row.rank === 1 ? 'city-winner-row' : ''}>
                                <td className="rank-num">#{row.rank}</td>
                                <td><strong>{row.city}</strong></td>
                                <td>
                                  <div className="city-score-cell">
                                    <span className="city-score-text">{row.suitabilityScore} / 100</span>
                                    <div className="city-score-mini-bar">
                                      <div
                                        className="city-score-fill"
                                        style={{
                                          width: `${Math.max(row.suitabilityScore, 5)}%`,
                                          backgroundColor: row.suitabilityScore >= 65 ? '#10b981' : row.suitabilityScore >= 45 ? '#f59e0b' : '#ef4444'
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`rank-badge badge-${row.classification?.toLowerCase()}`}>
                                    {row.classification}
                                  </span>
                                </td>
                                <td><span className="rank-risk">{row.riskLevel}</span></td>
                                <td>
                                  <button
                                    type="button"
                                    className="city-select-btn"
                                    onClick={() => onSelectCity && onSelectCity(row.city)}
                                    title={`Load weather details for ${row.city}`}
                                  >
                                    View City
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked Card View (< 640px) */}
                      <div className="ai-city-mobile-cards">
                        {(cityData.ranking || []).map((row) => (
                          <div key={row.rank} className={`ai-city-card-item ${row.rank === 1 ? 'winner-card' : ''}`}>
                            <div className="ai-city-card-header">
                              <div className="ai-city-card-title">
                                <span className="rank-num">#{row.rank}</span>
                                <span className="city-card-name">{row.city}</span>
                              </div>
                              <span className={`rank-badge badge-${row.classification?.toLowerCase()}`}>
                                {row.classification}
                              </span>
                            </div>
                            <div className="ai-city-card-body">
                              <div className="city-stat-pair">
                                <span className="stat-label">Suitability:</span>
                                <span className="stat-val"><strong>{row.suitabilityScore}/100</strong></span>
                              </div>
                              <div className="city-stat-pair">
                                <span className="stat-label">Risk Level:</span>
                                <span className="stat-val">{row.riskLevel}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="city-select-btn mobile"
                              onClick={() => onSelectCity && onSelectCity(row.city)}
                            >
                              Inspect {row.city}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="ai-city-comparison-launcher">
                      <div className="ai-city-launcher-icon">
                        <Compass size={32} />
                      </div>
                      <h4>Multi-City Comparison Engine</h4>
                      <p>
                        Compare meteorological suitability, composite hazard indices, and activity conditions
                        side-by-side between two or more destinations.
                      </p>
                      <div className="ai-launcher-suggestions">
                        <span className="launcher-subhead">Run an instant city comparison query:</span>
                        <div className="ai-launcher-chips">
                          <button
                            type="button"
                            className="ai-chip-btn"
                            onClick={() => handleSelectSuggested('Compare London and Paris for sightseeing')}
                          >
                            🏙️ London vs Paris (Sightseeing)
                          </button>
                          <button
                            type="button"
                            className="ai-chip-btn"
                            onClick={() => handleSelectSuggested('Compare Tokyo and Sydney for outdoor activities')}
                          >
                            🌏 Tokyo vs Sydney (Outdoor)
                          </button>
                          <button
                            type="button"
                            className="ai-chip-btn"
                            onClick={() => handleSelectSuggested('Compare New York and Berlin for travel')}
                          >
                            ✈️ New York vs Berlin (Travel)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Live Groq Copilot */}
              {activeTab === 'copilot' && (
                <div className="ai-tab-panel copilot-panel" role="tabpanel">
                  <div className="copilot-panel-header">
                    <div className="copilot-header-info">
                      <div className="copilot-avatar-glow">
                        <Bot size={24} />
                      </div>
                      <div>
                        <div className="copilot-title-row">
                          <h3>Groq Live AI Copilot</h3>
                          <span className="copilot-engine-chip">
                            <Zap size={13} /> {groqStatus.model || 'llama-3.3-70b-versatile'}
                          </span>
                          {groqStatus.configured || groqApiKey ? (
                            <span className="copilot-status-badge live">
                              <span className="status-live-dot" /> Live Connected
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="copilot-status-badge connect-btn"
                              onClick={() => {
                                setApiKeyInput(groqApiKey);
                                setShowApiKeyModal(true);
                              }}
                            >
                              <Key size={12} /> Connect Key
                            </button>
                          )}
                        </div>
                        <p className="copilot-subtitle">
                          Real-time conversational assistant grounded in live meteorological telemetry for{' '}
                          <strong>{normalizedCurrent?.cityName || activeCity || weatherData?.cityName || 'your location'}</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="copilot-key-settings-btn"
                      onClick={() => {
                        setApiKeyInput(groqApiKey);
                        setShowApiKeyModal(true);
                      }}
                      title="Manage Groq API Key"
                    >
                      <Key size={14} />
                      <span>{groqApiKey ? 'Key Active' : 'Set Key'}</span>
                    </button>
                  </div>

                  {/* Context Sensor HUD */}
                  <div className="copilot-telemetry-hud">
                    <div className="hud-metric">
                      <span className="hud-label">Temp</span>
                      <span className="hud-val">
                        {normalizedCurrent?.temperature ?? weatherData?.temperature ?? '--'}°C
                      </span>
                    </div>
                    <div className="hud-metric">
                      <span className="hud-label">Condition</span>
                      <span className="hud-val">
                        {normalizedCurrent?.weatherCondition ?? weatherData?.weatherCondition ?? 'Clear'}
                      </span>
                    </div>
                    <div className="hud-metric">
                      <span className="hud-label">Humidity</span>
                      <span className="hud-val">
                        {normalizedCurrent?.humidity ?? weatherData?.humidity ?? '--'}%
                      </span>
                    </div>
                    <div className="hud-metric">
                      <span className="hud-label">Wind</span>
                      <span className="hud-val">
                        {normalizedCurrent?.windSpeed ? `${Math.round(normalizedCurrent.windSpeed)} km/h` : weatherData?.windSpeed ? `${Math.round(weatherData.windSpeed * 3.6)} km/h` : '--'}
                      </span>
                    </div>
                    <div className="hud-metric">
                      <span className="hud-label">Suitability</span>
                      <span className="hud-val text-emerald">
                        {activityData?.suitability?.score != null ? `${activityData.suitability.score}/100` : 'Evaluated'}
                      </span>
                    </div>
                    <div className="hud-metric">
                      <span className="hud-label">Risk</span>
                      <span className="hud-val text-amber">
                        {riskData?.overallRisk?.level || 'LOW'}
                      </span>
                    </div>
                  </div>

                  {/* Chat Messages Feed */}
                  <div className="copilot-chat-feed">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`copilot-chat-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
                      >
                        <div className="copilot-msg-avatar">
                          {msg.role === 'user' ? (
                            <span>You</span>
                          ) : (
                            <Bot size={16} />
                          )}
                        </div>
                        <div className="copilot-msg-bubble">
                          <div className="copilot-msg-header">
                            <span className="copilot-sender-name">
                              {msg.role === 'user' ? 'You' : 'Groq WeatherPulse AI'}
                            </span>
                            <span className="copilot-msg-time">{msg.timestamp}</span>
                            {msg.latencyMs && (
                              <span className="copilot-latency-pill">{msg.latencyMs}ms</span>
                            )}
                          </div>
                          <div className="copilot-msg-body">
                            {msg.content.split('\n\n').map((para, pIdx) => (
                              <p key={pIdx}>{para}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {chatBusy && (
                      <div className="copilot-chat-row assistant-row typing-row">
                        <div className="copilot-msg-avatar">
                          <Bot size={16} />
                        </div>
                        <div className="copilot-msg-bubble typing-bubble">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-text">Groq LLaMA 3.3 thinking…</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Suggested Prompts */}
                  <div className="copilot-suggested-prompts">
                    <span className="prompts-label">Quick Questions:</span>
                    <div className="prompts-scroll">
                      {[
                        "What's the best time window for a run today?",
                        "What clothing & gear should I pack?",
                        "Will the rain affect my evening commute?",
                        "How will temperature and humidity feel around 2 PM?",
                        "Is it safe for kids to play sports outside today?"
                      ].map((promptText, i) => (
                        <button
                          key={i}
                          type="button"
                          className="copilot-prompt-chip"
                          onClick={() => handleSendChatMessage(promptText)}
                          disabled={chatBusy}
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chat Input Bar */}
                  <form
                    className="copilot-chat-input-bar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChatMessage();
                    }}
                  >
                    <input
                      type="text"
                      className="copilot-text-input"
                      placeholder={`Ask Groq AI about ${normalizedCurrent?.cityName || activeCity || 'weather'} conditions, outfits, travel, or timing...`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatBusy}
                    />
                    <button
                      type="submit"
                      className="copilot-send-btn"
                      disabled={!chatInput.trim() || chatBusy}
                    >
                      {chatBusy ? <LoaderCircle size={18} className="ai-spin" /> : <Send size={18} />}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Developer Diagnostic Section */}
          <details className="ai-dev-accordion">
            <summary className="ai-dev-summary">
              <Code size={14} />
              <span>Developer Diagnostic Payload (Raw JSON Debug)</span>
            </summary>
            <div className="ai-dev-panel">
              <div className="ai-dev-panel-header">
                <span className="ai-dev-badge">JSON CONTRACT</span>
                <button
                  type="button"
                  className="ai-copy-btn small"
                  onClick={handleCopyJson}
                >
                  {jsonCopied ? <Check size={12} className="copied-check" /> : <Copy size={12} />}
                  <span>{jsonCopied ? 'Copied' : 'Copy Payload'}</span>
                </button>
              </div>
              <pre className="ai-raw-json-viewer">
                {result ? JSON.stringify(result, null, 2) : '// No analysis response available'}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Groq API Key Configuration Modal */}
      {showApiKeyModal && (
        <div className="ai-modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="ai-modal-card" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="ai-modal-title">
                <Zap size={20} className="text-amber-gold" />
                <h3>Connect Live Groq LLM</h3>
              </div>
              <button 
                type="button" 
                className="ai-modal-close-btn"
                onClick={() => setShowApiKeyModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="ai-modal-body">
              <p>
                Accelerate real-time weather reasoning with <strong>Groq LLaMA 3.3 (70B)</strong>. Groq delivers lightning-fast inference at ~300 tokens/sec.
              </p>
              <div className="ai-modal-field">
                <label htmlFor="groq-key-input">Groq API Key</label>
                <input
                  id="groq-key-input"
                  type="password"
                  placeholder="gsk_..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  className="ai-modal-input"
                  autoFocus
                />
                <span className="ai-modal-help">
                  Get a free Groq key in seconds at{' '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
                    console.groq.com/keys <ExternalLink size={12} />
                  </a>
                  {' '}(Instant free tier, no credit card required).
                </span>
              </div>
            </div>
            <div className="ai-modal-actions">
              <button
                type="button"
                className="ai-modal-btn cancel"
                onClick={() => setShowApiKeyModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ai-modal-btn save"
                onClick={handleSaveApiKey}
              >
                <Check size={16} />
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {keySavedToast && (
        <div className="ai-key-toast">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>Groq API Key saved successfully!</span>
        </div>
      )}
    </section>
  );
}
