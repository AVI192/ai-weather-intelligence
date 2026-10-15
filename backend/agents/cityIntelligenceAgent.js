const clamp = (value, min = 0, max = 100) => {
  return Math.max(min, Math.min(max, value));
};

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const getActivityRiskScore = (cityResult) => {
  const score =
    cityResult?.activityRisk?.score ??
    cityResult?.activityRisk?.activityRiskScore;

  return typeof score === "number" && Number.isFinite(score) ? score : null;
};

const getOverallRiskScore = (cityResult) => {
  const score = cityResult?.overallRisk?.score;

  return typeof score === "number" && Number.isFinite(score) ? score : null;
};

const getTrendScore = (cityResult) => {
  const score = cityResult?.overallTrend?.score;

  return typeof score === "number" ? score : 50;
};

const calculateCitySuitability = (cityResult) => {
  const activityRisk = getActivityRiskScore(cityResult);
  const overallRisk = getOverallRiskScore(cityResult);
  const trendScore = getTrendScore(cityResult);

  const activitySuitability = 100 - activityRisk;
  const generalSuitability = 100 - overallRisk;

  let trendAdjustment = 0;

  if (trendScore <= 35) {
    trendAdjustment = 5;
  } else if (trendScore >= 65) {
    trendAdjustment = -5;
  }

  const score =
    activitySuitability * 0.70 +
    generalSuitability * 0.20 +
    50 * 0.10 +
    trendAdjustment;

  return clamp(Math.round(score));
};

const classifySuitability = (score) => {
  if (score >= 80) return "EXCELLENT";
  if (score >= 65) return "GOOD";
  if (score >= 45) return "MODERATE";
  if (score >= 25) return "POOR";

  return "UNSUITABLE";
};

const getRiskLevel = (score) => {
  if (score >= 80) return "VERY HIGH";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MODERATE";

  return "LOW";
};

const getTrendLevel = (score) => {
  if (score >= 65) return "WORSENING";
  if (score <= 35) return "IMPROVING";

  return "STABLE";
};

const generateFactors = (cityResult) => {
  const positive = [];
  const negative = [];

  const risks = cityResult?.risks || {};

  const checkRisk = (name, label) => {
    const score = risks[name]?.score;

    if (typeof score !== "number") return;

    if (score <= 20) {
      positive.push(`Low ${label} risk`);
    }

    if (score >= 60) {
      negative.push(`High ${label} risk`);
    }
  };

  checkRisk("heat", "heat");
  checkRisk("uv", "UV");
  checkRisk("rain", "rain");
  checkRisk("wind", "wind");
  checkRisk("visibility", "visibility");

  const trendScore = getTrendScore(cityResult);

  if (trendScore <= 35) {
    positive.push("Improving forecast trend");
  }

  if (trendScore >= 65) {
    negative.push("Worsening forecast trend");
  }

  return {
    positive: positive.slice(0, 5),
    negative: negative.slice(0, 5)
  };
};

const generateCityExplanation = (cityName, score, classification, activity, factors, overallRiskScore, trendScore, cityResult) => {
  const posText = factors?.positive?.length > 0 ? factors.positive.join(", ") : "Stable basic parameters";
  const negText = factors?.negative?.length > 0 ? `Identified weather concerns: ${factors.negative.join(", ")}.` : "No severe atmospheric hazards detected.";

  let weatherContext = "";
  if (typeof cityResult?.temperature === "number") {
    weatherContext = `Current temperature is ${Math.round(cityResult.temperature)}°C${typeof cityResult.feelsLike === "number" ? ` (feels like ${Math.round(cityResult.feelsLike)}°C)` : ""}. `;
  }

  return `${cityName} achieved an ${classification} suitability score (${score}/100) for ${activity}. ${weatherContext}Positive drivers: ${posText.toLowerCase()}. ${negText}`;
};

const generateWinnerReason = (winner, runnerUp, activity) => {
  if (!winner) return "";
  if (!runnerUp) {
    return `${winner.city} ranks #1 with a suitability score of ${winner.suitability.score}/100 (${winner.suitability.classification}) for ${activity}.`;
  }

  const diff = round(winner.suitability.score - runnerUp.suitability.score);
  let rationale = `${winner.city} takes top rank with ${winner.suitability.score}/100 (${winner.suitability.classification}), outperforming ${runnerUp.city} by ${diff} points for ${activity}.`;

  if (winner.risk.score < runnerUp.risk.score) {
    rationale += ` It features a significantly lower composite hazard risk (${winner.risk.level} vs ${runnerUp.risk.level}).`;
  } else if (winner.trend.score < runnerUp.trend.score) {
    rationale += ` Its barometric and cloud cover forecast trajectory is more favorable over the next 24 hours.`;
  } else {
    rationale += ` Overall atmospheric conditions align closer with optimal comfort profiles.`;
  }

  return rationale;
};

const generateLimitations = (activity, analyzedCities) => {
  const limitations = [];

  const actLower = String(activity).toLowerCase();
  if (actLower.includes("swim")) {
    limitations.push("Swimming suitability evaluation relies on air and radiant heat sensors; coastal water currents, surf hazards, and water temperature require local lifeguard verification.");
  } else if (actLower.includes("cycl") || actLower.includes("bike")) {
    limitations.push("Cycling safety requires vigilance on localized crosswinds and slick road surfaces during morning precipitation transitions.");
  } else if (actLower.includes("run") || actLower.includes("jog")) {
    limitations.push("Running scores assume standard exertion; high humidity and direct sun can compound perceived thermal strain.");
  } else if (actLower.includes("hike") || actLower.includes("trek")) {
    limitations.push("High altitude hiking trails frequently experience sudden microclimatic variations not reflected in standard city valley weather stations.");
  } else if (actLower.includes("sight") || actLower.includes("travel") || actLower.includes("tour")) {
    limitations.push("Urban pedestrian comfort can be affected by street-level wind canyons and urban heat island effects.");
  }

  const hasMissingUV = analyzedCities.some(c => c.uvIndex === null || c.uvIndex === undefined);
  if (hasMissingUV) {
    limitations.push("UV index telemetry is unavailable from certain ground stations; radiation risk is estimated via solar zenith and cloud attenuation.");
  }

  const hasMissingPrecip = analyzedCities.some(c => c.precipitation === null && c.rainProbability === null);
  if (hasMissingPrecip) {
    limitations.push("Precipitation gauges for one or more cities did not report minute-rate accumulations; forecast probability was utilized.");
  }

  return limitations;
};

const generateRecommendation = (winner, activity) => {
  if (!winner) {
    return `No reliable city recommendation is available for ${activity}.`;
  }

  if (winner.suitability.score >= 80) {
    return `${winner.city} is the strongest option for ${activity} under the analyzed conditions.`;
  }

  if (winner.suitability.score >= 65) {
    return `${winner.city} is a good option for ${activity}, although some weather-related limitations remain.`;
  }

  if (winner.suitability.score >= 45) {
    return `${winner.city} is moderately suitable for ${activity}; consider the identified weather risks before deciding.`;
  }

  return `${winner.city} is not an ideal option for ${activity} under the analyzed conditions.`;
};

export const analyzeCityIntelligence = ({
  cities,
  activity = "general"
}) => {
  if (!Array.isArray(cities) || cities.length < 2) {
    return {
      agent: {
        name: "City Intelligence Agent",
        version: "2.0",
        status: "failed"
      },
      success: false,
      message: "At least two cities are required for comparison."
    };
  }

  const validCitiesInput = cities.filter((cityResult) => {
    const actScore = getActivityRiskScore(cityResult);
    const ovrScore = getOverallRiskScore(cityResult);
    return actScore !== null && ovrScore !== null && cityResult?.success !== false;
  });

  if (validCitiesInput.length < 2) {
    return {
      agent: {
        name: "City Intelligence Agent",
        version: "2.0",
        status: "failed"
      },
      success: false,
      message: "Insufficient or invalid weather risk data for city comparison."
    };
  }

  const analyzedCities = validCitiesInput.map((cityResult) => {
    const score = calculateCitySuitability(cityResult);
    const activityRiskScore = getActivityRiskScore(cityResult);
    const overallRiskScore = getOverallRiskScore(cityResult);
    const trendScore = getTrendScore(cityResult);
    const factors = generateFactors(cityResult);
    const classification = classifySuitability(score);

    const explanation = generateCityExplanation(
      cityResult.city,
      score,
      classification,
      activity,
      factors,
      overallRiskScore,
      trendScore,
      cityResult
    );

    return {
      city: cityResult.city,
      country: cityResult.country || "",
      coordinates: cityResult.coordinates || null,

      suitability: {
        score,
        classification
      },

      risk: {
        score: round(overallRiskScore),
        level: getRiskLevel(overallRiskScore)
      },

      activityRisk: {
        score: round(activityRiskScore),
        level: getRiskLevel(activityRiskScore)
      },

      trend: {
        score: round(trendScore),
        level: getTrendLevel(trendScore)
      },

      // Weather Telemetry (Preserved & Distinguishing Missing Values)
      temperature: typeof cityResult.temperature === "number" ? round(cityResult.temperature, 1) : null,
      feelsLike: typeof cityResult.feelsLike === "number" ? round(cityResult.feelsLike, 1) : null,
      humidity: typeof cityResult.humidity === "number" ? round(cityResult.humidity, 0) : null,
      windSpeed: typeof cityResult.windSpeed === "number" ? round(cityResult.windSpeed, 1) : null,
      precipitation: typeof cityResult.precipitation === "number" ? round(cityResult.precipitation, 2) : null,
      rainProbability: typeof cityResult.rainProbability === "number" ? round(cityResult.rainProbability, 0) : null,
      uvIndex: typeof cityResult.uvIndex === "number" ? round(cityResult.uvIndex, 1) : null,
      weatherCondition: cityResult.weatherCondition || "",
      weatherDescription: cityResult.weatherDescription || "",

      factors,
      risks: cityResult.risks || {},
      explanation
    };
  });

  analyzedCities.sort(
    (a, b) =>
      b.suitability.score -
      a.suitability.score
  );

  const winner = analyzedCities[0];
  const runnerUp = analyzedCities[1];

  const scoreDifference =
    runnerUp
      ? round(
          winner.suitability.score -
          runnerUp.suitability.score
        )
      : null;

  const winnerReason = generateWinnerReason(winner, runnerUp, activity);
  const limitations = generateLimitations(activity, analyzedCities);

  return {
    agent: {
      name: "City Intelligence Agent",
      version: "2.0",
      status: "completed"
    },

    activity,
    citiesAnalyzed: analyzedCities.length,

    ranking: analyzedCities.map((city, index) => ({
      rank: index + 1,
      city: city.city,
      country: city.country,
      suitabilityScore: city.suitability.score,
      classification: city.suitability.classification,
      riskLevel: city.risk.level,
      riskScore: city.risk.score,
      trendLevel: city.trend.level,
      trendScore: city.trend.score,
      temperature: city.temperature,
      feelsLike: city.feelsLike,
      humidity: city.humidity,
      windSpeed: city.windSpeed,
      precipitation: city.precipitation,
      rainProbability: city.rainProbability,
      uvIndex: city.uvIndex,
      weatherCondition: city.weatherCondition,
      weatherDescription: city.weatherDescription,
      explanation: city.explanation,
      factors: city.factors,
      risks: city.risks
    })),

    winner: {
      city: winner.city,
      country: winner.country,
      score: winner.suitability.score,
      classification: winner.suitability.classification,
      scoreDifference,
      reason: winnerReason
    },

    recommendation: generateRecommendation(winner, activity),
    limitations,
    comparison: analyzedCities
  };
};