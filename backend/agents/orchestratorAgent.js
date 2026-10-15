
import { analyzeWeatherData } from "./dataIntelligenceAgent.js";
import { analyzeWeatherRisk } from "./riskIntelligenceAgent.js";
import { analyzeForecastTrend } from "./forecastTrendAgent.js";
import { analyzeActivityDecision } from "./activityDecisionAgent.js";
import { analyzeCityIntelligence } from "./cityIntelligenceAgent.js";
import { reasonAboutWeather } from "./weatherReasoningAgent.js";
import {
  searchLocations,
  getCurrentWeather,
  getForecast,
  getUVIndex
} from "../services/openWeatherService.js";
import { generateGroqInsight } from "../services/groqService.js";

const CITY_DATABASE = {
  pune: { name: "Pune", country: "IN", lat: 18.5204, lon: 73.8567 },
  mumbai: { name: "Mumbai", country: "IN", lat: 19.0760, lon: 72.8777 },
  delhi: { name: "Delhi", country: "IN", lat: 28.6139, lon: 77.2090 },
  bangalore: { name: "Bangalore", country: "IN", lat: 12.9716, lon: 77.5946 },
  bengaluru: { name: "Bangalore", country: "IN", lat: 12.9716, lon: 77.5946 },
  indore: { name: "Indore", country: "IN", lat: 22.7196, lon: 75.8577 }
};

const normalizeQuery = (query = "") => {
  return String(query)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

// Match complete words instead of accidental substrings.
const containsKeyword = (query, keyword) => {
  const escaped = keyword.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  return new RegExp(`\\b${escaped}\\b`, "i").test(query);
};

const detectActivity = (query) => {
  const activities = {
    running: ["running", "run", "jogging", "jog"],
    walking: ["walking", "walk", "stroll"],
    cycling: ["cycling", "bike ride", "biking", "bike", "cycle"],
    swimming: ["swimming", "swim", "pool"],
    hiking: ["hiking", "hike", "trekking", "trek"],
    cricket: ["cricket"],
    travel: ["travel", "trip", "journey", "sightseeing", "tour"],
    photography: ["photography", "photo", "photograph", "photoshoot"],
    driving: ["driving", "drive", "road trip", "commute"],
    stargazing: ["stargazing", "stars", "night sky", "astronomy"],
    outdoor_dining: ["outdoor dining", "dining", "patio", "bbq", "barbecue", "picnic"],
    outdoor_event: ["outdoor event", "event", "gathering", "match", "festival"]
  };

  for (const [activity, keywords] of Object.entries(activities)) {
    if (keywords.some(keyword => containsKeyword(query, keyword))) {
      return activity;
    }
  }

  return null;
};

// Extract potential city names from comparison queries (e.g., "compare London and Paris", "Tokyo vs Kyoto")
const extractComparisonCities = (query) => {
  const cleaned = query.replace(/[?!.,]/g, "").trim();
  
  // Pattern 1: compare/between CityA and/with/to/vs CityB
  const p1 = cleaned.match(/\b(?:compare|comparison(?: between)?|between)\s+([a-zA-Z\s.-]+?)\s+(?:and|with|to|vs|versus)\s+([a-zA-Z\s.-]+?)(?:\s+(?:for|in|during)|$)/i);
  if (p1 && p1[1] && p1[2]) {
    const c1 = p1[1].trim();
    const c2 = p1[2].trim();
    if (c1.length > 1 && c2.length > 1 && !/\b(weather|forecast|risk)\b/i.test(c1) && !/\b(weather|forecast|risk)\b/i.test(c2)) {
      return [c1, c2];
    }
  }

  // Pattern 2: CityA vs/versus CityB
  const p2 = cleaned.match(/([a-zA-Z\s.-]+?)\s+(?:vs|versus)\s+([a-zA-Z\s.-]+?)(?:\s+(?:for|in|during)|$)/i);
  if (p2 && p2[1] && p2[2]) {
    const c1 = p2[1].trim();
    const c2 = p2[2].trim();
    if (c1.length > 1 && c2.length > 1) {
      return [c1, c2];
    }
  }

  // Pattern 3: which is better CityA or CityB
  const p3 = cleaned.match(/(?:which is better|better)\s+(?:between\s+)?([a-zA-Z\s.-]+?)\s+(?:or|and)\s+([a-zA-Z\s.-]+?)(?:\s+(?:for|in|during)|$)/i);
  if (p3 && p3[1] && p3[2]) {
    const c1 = p3[1].trim();
    const c2 = p3[2].trim();
    if (c1.length > 1 && c2.length > 1) {
      return [c1, c2];
    }
  }

  return [];
};

// Extract single city targeted with prepositions (e.g. "in Paris", "for Tokyo", "at London")
const extractTargetCity = (query) => {
  const directMatch = query.match(/\b(?:in|at|near)\s+([a-zA-Z\s.-]{2,50}?)(?:\s+(?:today|tomorrow|tonight|this afternoon|this morning|right now)|[?!.,]|$)/i);
  const match = directMatch || query.match(/\b(?:for)\s+([a-zA-Z\s.-]{2,50}?)(?:\s+(?:today|tomorrow|tonight|this afternoon|this morning|right now)|[?!.,]|$)/i);
  if (match && match[1]) {
    const candidate = match[1].trim();
    const stopWords = ["running", "cycling", "swimming", "hiking", "travel", "photography", "driving", "outdoor dining", "today", "tomorrow", "tonight", "me", "us", "weather", "forecast", "risk", "comfort", "safe", "sightseeing"];
    if (!stopWords.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
};

// Bengaluru and Bangalore are aliases for one city.
const detectCities = (query) => {
  const cityAliases = {
    pune: ["pune"],
    mumbai: ["mumbai"],
    delhi: ["delhi"],
    bangalore: ["bangalore", "bengaluru"],
    indore: ["indore"],
    london: ["london"],
    paris: ["paris"],
    tokyo: ["tokyo"],
    new_york: ["new york", "nyc"]
  };

  const detectedCities = [];

  for (const [city, aliases] of Object.entries(cityAliases)) {
    if (aliases.some(alias => containsKeyword(query, alias))) {
      detectedCities.push(city);
    }
  }

  const comparisonCities = extractComparisonCities(query);
  for (const c of comparisonCities) {
    const key = c.toLowerCase();
    if (!detectedCities.includes(key)) {
      detectedCities.push(key);
    }
  }

  return detectedCities;
};

const detectIntent = (query) => {
  const normalized = normalizeQuery(query);
  const cities = detectCities(normalized);
  const comparisonCities = extractComparisonCities(normalized);
  const activity = detectActivity(normalized);

  const comparisonKeywords = [
    "compare",
    "comparison",
    "which is better",
    "better between",
    "versus",
    "vs",
    "or"
  ];

  const riskKeywords = [
    "risk",
    "danger",
    "dangerous",
    "safe",
    "safety",
    "hazard",
    "hazards",
    "concern",
    "concerns",
    "alert",
    "alerts"
  ];

  const trendKeywords = [
    "trend",
    "forecast",
    "tomorrow",
    "later",
    "next few hours",
    "next hours",
    "improving",
    "worsening",
    "getting worse"
  ];

  const reasoningKeywords = [
    "why",
    "feels",
    "uncomfortable",
    "explain",
    "reason"
  ];

  const matchesAny = keywords =>
    keywords.some(keyword => containsKeyword(normalized, keyword));

  // 1. Multi-city comparison intent
  if (
    (cities.length >= 2 || comparisonCities.length >= 2) &&
    (matchesAny(comparisonKeywords) || activity)
  ) {
    const resolvedCities = cities.length >= 2 ? cities : comparisonCities;
    return {
      intent: "CITY_COMPARISON",
      activity: activity || "general",
      cities: resolvedCities,
      confidence: 0.95
    };
  }

  // 2. Activity decision takes precedence when an activity is specified
  // (e.g., "Is it safe for cycling this afternoon?" should run Activity Decision, not be trapped in Risk Assessment)
  if (activity) {
    return {
      intent: "ACTIVITY_DECISION",
      activity,
      cities,
      confidence: 0.92
    };
  }

  // 3. Risk assessment (only when NO specific activity was requested)
  if (matchesAny(riskKeywords)) {
    return {
      intent: "RISK_ASSESSMENT",
      activity: "general",
      cities,
      confidence: 0.88
    };
  }

  // 4. Forecast trend (only when NO specific activity was requested)
  if (matchesAny(trendKeywords)) {
    return {
      intent: "FORECAST_TREND",
      activity: "general",
      cities,
      confidence: 0.85
    };
  }

  // 5. Bio-thermal reasoning
  if (matchesAny(reasoningKeywords)) {
    return {
      intent: "WEATHER_REASONING",
      activity: "general",
      cities,
      confidence: 0.85
    };
  }

  // 6. General weather fallback
  return {
    intent: "GENERAL_WEATHER",
    activity: "general",
    cities,
    confidence: 0.70
  };
};

const buildExecutionPlan = (intentResult) => {
  const plans = {
    CITY_COMPARISON: [
      "data", "risk", "trend", "activity", "city", "llm"
    ],
    ACTIVITY_DECISION: [
      "data", "risk", "trend", "activity", "llm"
    ],
    RISK_ASSESSMENT: [
      "data", "risk", "llm"
    ],
    FORECAST_TREND: [
      "data", "trend", "llm"
    ],
    WEATHER_REASONING: [
      "data", "reasoning", "llm"
    ],
    GENERAL_WEATHER: [
      "data", "risk", "trend", "reasoning", "llm"
    ]
  };

  return plans[intentResult.intent] || ["data", "llm"];
};

const formatCurrentForDataAgent = (current, latitude, longitude) => {
  if (!current) return null;
  return {
    cityName: current?.name || current?.cityName || "",
    country: current?.sys?.country || current?.country || "",
    coord: {
      lat: Number.isFinite(current?.coord?.lat)
        ? current.coord.lat
        : (Number.isFinite(latitude) ? latitude : null),
      lon: Number.isFinite(current?.coord?.lon)
        ? current.coord.lon
        : (Number.isFinite(longitude) ? longitude : null)
    },
    temperature:
      typeof current?.main?.temp === "number"
        ? current.main.temp
        : (current?.temperatureCelsius ?? current?.temperature ?? null),
    feelsLike:
      typeof current?.main?.feels_like === "number"
        ? current.main.feels_like
        : (current?.feelsLikeCelsius ?? current?.feelsLike ?? null),
    humidity:
      typeof current?.main?.humidity === "number"
        ? current.main.humidity
        : (current?.humidityPercent ?? current?.humidity ?? null),
    pressure:
      typeof current?.main?.pressure === "number"
        ? current.main.pressure
        : (current?.pressureHpa ?? current?.pressure ?? null),
    visibility:
      typeof current?.visibility === "number"
        ? (current.visibility > 100 ? current.visibility / 1000 : current.visibility)
        : (current?.visibilityKm ?? null),
    windSpeed:
      typeof current?.wind?.speed === "number"
        ? current.wind.speed * 3.6
        : (current?.windSpeedKmh ?? current?.windSpeed ?? null),
    weatherCondition:
      current?.weather?.[0]?.main || current?.condition || current?.weatherCondition || "",
    weatherDescription:
      current?.weather?.[0]?.description || current?.description || current?.weatherDescription || "",
    iconCode:
      current?.weather?.[0]?.icon || current?.iconCode || "",
    dt: current?.dt || null
  };
};

export const prepareWeatherData = (current, forecast, uvData) => {
  const firstForecast = forecast?.list?.[0];
  const rainProbability =
    typeof firstForecast?.pop === "number"
      ? firstForecast.pop
      : null;

  return {
    cityName: current?.name || current?.cityName || "",
    country: current?.sys?.country || current?.country || "",
    coord: {
      lat: current?.coord?.lat ?? current?.coord?.latitude ?? null,
      lon: current?.coord?.lon ?? current?.coord?.longitude ?? null
    },
    temperatureCelsius:
      typeof current?.main?.temp === "number"
        ? current.main.temp
        : (current?.temperatureCelsius ?? current?.temperature ?? null),
    feelsLikeCelsius:
      typeof current?.main?.feels_like === "number"
        ? current.main.feels_like
        : (current?.feelsLikeCelsius ?? current?.feelsLike ?? null),
    humidityPercent:
      typeof current?.main?.humidity === "number"
        ? current.main.humidity
        : (current?.humidityPercent ?? current?.humidity ?? null),
    pressureHpa:
      typeof current?.main?.pressure === "number"
        ? current.main.pressure
        : (current?.pressureHpa ?? current?.pressure ?? null),
    windSpeedKmh:
      typeof current?.wind?.speed === "number"
        ? current.wind.speed * 3.6
        : (current?.windSpeedKmh ?? current?.windSpeed ?? null),
    visibilityKm:
      typeof current?.visibility === "number"
        ? (current.visibility > 100 ? current.visibility / 1000 : current.visibility)
        : (current?.visibilityKm ?? current?.visibility ?? null),
    condition:
      current?.weather?.[0]?.main || current?.condition || current?.weatherCondition || "",
    description:
      current?.weather?.[0]?.description || current?.description || "",
    rainProbability,
    uvIndex:
      typeof uvData?.uvIndex === "number"
        ? uvData.uvIndex
        : (typeof uvData === "number" ? uvData : null)
  };
};

export const orchestrateWeatherQuery = ({
  query,
  latitude,
  longitude
}) => {
  const intentResult = detectIntent(query);
  const executionPlan = buildExecutionPlan(intentResult);

  return {
    orchestrator: {
      name: "AI Weather Orchestrator",
      version: "1.0",
      status: "planned"
    },
    query,
    location: {
      latitude,
      longitude
    },
    intent: intentResult.intent,
    activity: intentResult.activity,
    cities: intentResult.cities,
    routingConfidence: intentResult.confidence,
    executionPlan,
    routingReason:
      `Query classified as ${intentResult.intent}. ` +
      `Selected ${executionPlan.length} specialized agent(s).`
  };
};

const buildCityAnalyses = async (cityNames, activity = "general") => {
  const analyses = [];

  for (const name of cityNames) {
    if (typeof name !== "string" || !name.trim()) continue;

    let lat = null;
    let lon = null;
    let cityName = name;
    let countryName = "";

    const key = name.trim().toLowerCase();

    if (CITY_DATABASE[key]) {
      lat = CITY_DATABASE[key].lat;
      lon = CITY_DATABASE[key].lon;
      cityName = CITY_DATABASE[key].name;
      countryName = CITY_DATABASE[key].country;
    } else {
      try {
        const locations = await searchLocations(name);
        if (locations.length > 0) {
          lat = locations[0].lat;
          lon = locations[0].lon;
          cityName = locations[0].name;
          countryName = locations[0].country;
        }
      } catch (err) {
        console.warn(`Failed to locate city ${name}:`, err.message);
      }
    }

    if (lat === null || lon === null) continue;

    try {
      const [current, forecast, uv] = await Promise.all([
        getCurrentWeather(lat, lon),
        getForecast(lat, lon),
        getUVIndex(lat, lon).catch((err) => {
          console.warn(`UV index fetch failed for ${name}:`, err.message);
          return { uvIndex: null };
        })
      ]);

      const prepared = prepareWeatherData(current, forecast, uv);

      const riskResult = analyzeWeatherRisk({
        current: prepared,
        uvIndex: prepared.uvIndex,
        rainProbability: prepared.rainProbability,
        activity
      });

      const trendResult = analyzeForecastTrend(forecast?.list || []);

      analyses.push({
        city: cityName || current?.name || name,
        country: countryName || current?.sys?.country || "",
        coordinates: { latitude: lat, longitude: lon },
        risks: riskResult.risks,
        overallRisk: riskResult.overallRisk,
        activityRisk: riskResult.activityRisk,
        overallTrend: trendResult.overallTrend,
        interactions: riskResult.interactions || []
      });
    } catch (err) {
      console.warn(`Failed to generate analysis for city ${name}:`, err.message);
    }
  }

  return analyses;
};

export const executeWeatherPlan = async ({
  query = "",
  latitude = null,
  longitude = null,
  current = null,
  forecast = null,
  uvData = null,
  activity = null,
  cityAnalyses = [],
  cities = [],
  apiKey = null
}) => {
  const plan = orchestrateWeatherQuery({ query, latitude, longitude });
  const selectedActivity = activity || plan.activity || "general";
  const executionPlan = plan.executionPlan || ["data"];

  let activeLat = Number.isFinite(latitude) ? latitude : null;
  let activeLon = Number.isFinite(longitude) ? longitude : null;

  // Resolve target cities and explicit city mentions
  const explicitTargetCity = extractTargetCity(query);
  const targetCities = (Array.isArray(cities) && cities.length > 0)
    ? cities
    : (explicitTargetCity ? [explicitTargetCity] : (plan.cities || []));

  // If a specific city was explicitly mentioned in the query, that city takes precedence over ambient/fallback coordinates
  const detectedQueryCities = plan.cities || [];
  const hasExplicitCity = Boolean(explicitTargetCity || detectedQueryCities.length > 0);
  let cityToResolve = explicitTargetCity || (targetCities.length > 0 && typeof targetCities[0] === "string" ? targetCities[0] : null);

  if (hasExplicitCity || activeLat === null || activeLon === null) {
    if (cityToResolve && typeof cityToResolve === "string") {
      const cityKey = cityToResolve.toLowerCase().trim();
      if (CITY_DATABASE[cityKey]) {
        activeLat = CITY_DATABASE[cityKey].lat;
        activeLon = CITY_DATABASE[cityKey].lon;
      } else {
        try {
          const locations = await searchLocations(cityToResolve);
          if (locations.length > 0) {
            activeLat = locations[0].lat;
            activeLon = locations[0].lon;
          }
        } catch (err) {
          console.warn(`Location search failed for city ${cityToResolve}:`, err.message);
        }
      }
    }
  }

  // Fetch weather data if not provided
  let currentData = current;
  let forecastData = forecast;
  let uvVal = uvData;

  if ((!currentData || !forecastData) && activeLat !== null && activeLon !== null) {
    try {
      const [fetchedCurrent, fetchedForecast, fetchedUv] = await Promise.all([
        currentData ? Promise.resolve(currentData) : getCurrentWeather(activeLat, activeLon),
        forecastData ? Promise.resolve(forecastData) : getForecast(activeLat, activeLon),
        (uvVal !== null && uvVal !== undefined)
          ? Promise.resolve(uvVal)
          : getUVIndex(activeLat, activeLon).catch((err) => {
              console.warn("UV index fetch failed:", err.message);
              return { uvIndex: null };
            })
      ]);
      currentData = fetchedCurrent;
      forecastData = fetchedForecast;
      uvVal = fetchedUv;
    } catch (err) {
      return {
        orchestrator: {
          name: "AI Weather Orchestrator",
          version: "1.0",
          status: "failed"
        },
        success: false,
        message: `Failed to fetch weather data: ${err.message}`,
        intent: plan.intent,
        activity: selectedActivity,
        executionPlan,
        executedAgents: [],
        agentStatuses: {
          data: "failed",
          risk: "skipped",
          trend: "skipped",
          activity: "skipped",
          city: "skipped",
          reasoning: "skipped"
        },
        isPartial: true
      };
    }
  }

  if (!currentData) {
    return {
      orchestrator: {
        name: "AI Weather Orchestrator",
        version: "1.0",
        status: "failed"
      },
      success: false,
      message: "Weather data is required for orchestration. Provide coordinates or city in request.",
      intent: plan.intent,
      activity: selectedActivity,
      executionPlan,
      executedAgents: [],
      agentStatuses: {
        data: "failed",
        risk: "skipped",
        trend: "skipped",
        activity: "skipped",
        city: "skipped",
        reasoning: "skipped"
      },
      isPartial: true
    };
  }

  // 1. Data Intelligence Agent (always first step)
  const formattedCurrentForData = formatCurrentForDataAgent(currentData, activeLat, activeLon);
  const rawUvNumber = typeof uvVal === "number" ? uvVal : (typeof uvVal?.uvIndex === "number" ? uvVal.uvIndex : null);

  const dataQualityResult = analyzeWeatherData({
    current: formattedCurrentForData,
    forecast: forecastData,
    uv: rawUvNumber
  });

  if (!dataQualityResult?.decision?.readyForAI) {
    return {
      orchestrator: {
        name: "AI Weather Orchestrator",
        version: "1.0",
        status: "failed"
      },
      success: false,
      message: "Weather data is insufficient for downstream decision-making.",
      intent: plan.intent,
      activity: selectedActivity,
      executionPlan,
      executedAgents: ["data"],
      agentStatuses: {
        data: "failed",
        risk: "skipped",
        trend: "skipped",
        activity: "skipped",
        city: "skipped",
        reasoning: "skipped"
      },
      isPartial: true,
      dataQuality: dataQualityResult?.dataQuality,
      checks: dataQualityResult?.checks
    };
  }

  const agentStatuses = {
    data: "completed",
    risk: "skipped",
    trend: "skipped",
    activity: "skipped",
    city: "skipped",
    reasoning: "skipped",
    llm: "skipped"
  };
  const executedAgents = ["data"];

  const preparedWeather = prepareWeatherData(currentData, forecastData, uvVal);
  const results = {
    orchestrator: {
      name: "AI Weather Orchestrator",
      version: "1.0",
      status: "completed"
    },
    success: true,
    query,
    intent: plan.intent,
    activity: selectedActivity,
    executionPlan,
    dataQuality: dataQualityResult.dataQuality,
    normalizedData: dataQualityResult.normalizedData
  };

  // 2. Risk Intelligence Agent
  if (executionPlan.includes("risk")) {
    executedAgents.push("risk");
    try {
      results.riskResult = analyzeWeatherRisk({
        current: preparedWeather,
        uvIndex: preparedWeather.uvIndex,
        rainProbability: preparedWeather.rainProbability,
        activity: selectedActivity
      });
      agentStatuses.risk = results.riskResult?.success === false ? "failed" : "completed";
    } catch (err) {
      agentStatuses.risk = "failed";
      results.riskResult = {
        agent: { name: "Risk Intelligence Agent", version: "2.0.0", status: "failed" },
        success: false,
        message: err.message || "Risk analysis failed."
      };
    }
  }

  // 3. Forecast Trend Agent
  if (executionPlan.includes("trend")) {
    executedAgents.push("trend");
    try {
      results.trendResult = analyzeForecastTrend(forecastData?.list || []);
      agentStatuses.trend = results.trendResult?.success === false ? "failed" : "completed";
    } catch (err) {
      agentStatuses.trend = "failed";
      results.trendResult = {
        agent: { name: "Forecast Trend Agent", version: "1.0", status: "failed" },
        success: false,
        message: err.message || "Forecast trend analysis failed."
      };
    }
  }

  // 4. Activity Decision Agent
  if (executionPlan.includes("activity")) {
    executedAgents.push("activity");
    try {
      if (!results.riskResult || results.riskResult.activityRisk?.score === null || results.riskResult.activityRisk?.score === undefined) {
        agentStatuses.activity = "failed";
        results.activityDecision = {
          agent: { name: "Activity Decision Agent", version: "1.0", status: "failed" },
          success: false,
          message: "Activity decision requires a valid activity-specific risk score."
        };
      } else {
        results.activityDecision = analyzeActivityDecision({
          activity: selectedActivity,
          riskResult: results.riskResult,
          trendResult: results.trendResult
        });
        agentStatuses.activity = results.activityDecision?.success === false ? "failed" : "completed";
      }
    } catch (err) {
      agentStatuses.activity = "failed";
      results.activityDecision = {
        agent: { name: "Activity Decision Agent", version: "1.0", status: "failed" },
        success: false,
        message: err.message || "Activity decision analysis failed."
      };
    }
  }

  // 5. City Intelligence Agent
  if (executionPlan.includes("city")) {
    executedAgents.push("city");
    try {
      let resolvedCityAnalyses = [];

      if (Array.isArray(cityAnalyses) && cityAnalyses.length >= 2) {
        resolvedCityAnalyses = cityAnalyses;
      } else if (Array.isArray(cities) && cities.length >= 2 && typeof cities[0] === "object" && cities[0] !== null) {
        resolvedCityAnalyses = cities;
      } else {
        const cityNames = (Array.isArray(cities) && cities.length >= 2)
          ? cities
          : (plan.cities && plan.cities.length >= 2 ? plan.cities : []);

        if (cityNames.length >= 2) {
          resolvedCityAnalyses = await buildCityAnalyses(cityNames, selectedActivity);
        }
      }

      if (!Array.isArray(resolvedCityAnalyses) || resolvedCityAnalyses.length < 2) {
        agentStatuses.city = "failed";
        results.cityResult = {
          agent: { name: "City Intelligence Agent", version: "1.0", status: "failed" },
          success: false,
          message: "At least two cities with valid weather data are required for comparison."
        };
      } else {
        results.cityResult = analyzeCityIntelligence({
          cities: resolvedCityAnalyses,
          activity: selectedActivity
        });
        agentStatuses.city = results.cityResult?.success === false ? "failed" : "completed";
      }
    } catch (err) {
      agentStatuses.city = "failed";
      results.cityResult = {
        agent: { name: "City Intelligence Agent", version: "1.0", status: "failed" },
        success: false,
        message: err.message || "City comparison failed."
      };
    }
  }

  // 6. Weather Reasoning Agent
  if (executionPlan.includes("reasoning")) {
    executedAgents.push("reasoning");
    try {
      results.reasoningResult = reasonAboutWeather({
        current: preparedWeather,
        uvIndex: preparedWeather.uvIndex
      });
      agentStatuses.reasoning = results.reasoningResult?.success === false ? "failed" : "completed";
    } catch (err) {
      agentStatuses.reasoning = "failed";
      results.reasoningResult = {
        agent: { name: "Weather Reasoning Agent", version: "1.0.0", status: "failed" },
        success: false,
        message: err.message || "Weather reasoning failed."
      };
    }
  }

  // 7. Live Groq LLM Intelligence Agent
  if (executionPlan.includes("llm")) {
    executedAgents.push("llm");
    try {
      results.llmInsight = await generateGroqInsight({
        query,
        location: {
          cityName: preparedWeather.cityName,
          country: preparedWeather.country,
          latitude: activeLat,
          longitude: activeLon
        },
        current: preparedWeather,
        forecast: forecastData,
        risks: results.riskResult,
        trends: results.trendResult,
        activityDecision: results.activityDecision,
        reasoning: results.reasoningResult
      }, apiKey);
      agentStatuses.llm = results.llmInsight?.isLiveGroq ? "completed" : "fallback";
    } catch (err) {
      console.warn("Groq LLM agent step failed:", err.message);
      agentStatuses.llm = "failed";
      results.llmInsight = {
        agent: { name: "Groq LLM Agent", version: "1.0", status: "failed" },
        success: false,
        message: err.message
      };
    }
  }

  results.executedAgents = executedAgents;
  results.agentStatuses = agentStatuses;
  results.isPartial = Object.values(agentStatuses).some(s => s === "failed");

  return results;
};

export const executeOrchestratedQuery = executeWeatherPlan;

