const isValidNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const clamp = (value, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Determines the direction of a numerical trend.
 *
 * changePercent is relative change from first value to last value.
 */
const getDirection = (
  changePercent,
  threshold = 10
) => {
  if (changePercent >= threshold) return "RISING";
  if (changePercent <= -threshold) return "FALLING";
  return "STABLE";
};

/**
 * Calculate trend for a numerical forecast parameter.
 */
const calculateTrend = (
  values,
  threshold = 10
) => {
  const validValues = values.filter(isValidNumber);

  if (validValues.length < 2) {
    return {
      direction: "INSUFFICIENT_DATA",
      change: null,
      changePercent: null
    };
  }

  const first = validValues[0];
  const last = validValues[validValues.length - 1];

  const change = last - first;

  const changePercent =
    first !== 0
      ? (change / Math.abs(first)) * 100
      : 0;

  return {
    direction: getDirection(changePercent, threshold),
    startValue: round(first),
    endValue: round(last),
    change: round(change),
    changePercent: round(changePercent)
  };
};

/**
 * Calculate rain probability trend.
 */
const calculateRainTrend = (values) => {
  const validValues = values.filter(isValidNumber);

  if (validValues.length < 2) {
    return {
      direction: "INSUFFICIENT_DATA",
      startValue: null,
      endValue: null,
      change: null
    };
  }

  const first = validValues[0];
  const last = validValues[validValues.length - 1];

  const change = last - first;

  let direction = "STABLE";

  if (change >= 15) {
    direction = "INCREASING";
  } else if (change <= -15) {
    direction = "DECREASING";
  }

  return {
    direction,
    startValue: round(first),
    endValue: round(last),
    change: round(change)
  };
};

/**
 * Extract dominant weather conditions.
 */
const analyzeWeatherConditions = (forecast) => {
  const conditions = forecast
    .map((item) => item?.weather?.[0]?.main)
    .filter(Boolean);

  if (!conditions.length) {
    return {
      dominant: null,
      changes: []
    };
  }

  const frequency = {};

  conditions.forEach((condition) => {
    frequency[condition] =
      (frequency[condition] || 0) + 1;
  });

  const dominant = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])[0][0];

  const changes = [];

  for (let i = 1; i < conditions.length; i++) {
    if (conditions[i] !== conditions[i - 1]) {
      changes.push({
        from: conditions[i - 1],
        to: conditions[i]
      });
    }
  }

  return {
    dominant,
    changes
  };
};

/**
 * Identify important changes in the forecast.
 */
const generateKeyChanges = ({
  temperatureTrend,
  humidityTrend,
  rainTrend,
  windTrend,
  conditionAnalysis
}) => {
  const changes = [];

  if (temperatureTrend.direction === "RISING") {
    changes.push("Temperature is increasing.");
  }

  if (temperatureTrend.direction === "FALLING") {
    changes.push("Temperature is decreasing.");
  }

  if (rainTrend.direction === "INCREASING") {
    changes.push(
      "Rain probability is increasing."
    );
  }

  if (rainTrend.direction === "DECREASING") {
    changes.push(
      "Rain probability is decreasing."
    );
  }

  if (humidityTrend.direction === "RISING") {
    changes.push("Humidity is increasing.");
  }

  if (humidityTrend.direction === "FALLING") {
    changes.push("Humidity is decreasing.");
  }

  if (windTrend.direction === "RISING") {
    changes.push("Wind speed is increasing.");
  }

  if (windTrend.direction === "FALLING") {
    changes.push("Wind speed is decreasing.");
  }

  if (conditionAnalysis.changes.length > 0) {
    changes.push(
      "Weather conditions are changing during the forecast period."
    );
  }

  return changes;
};

/**
 * Determine the overall forecast trend.
 */
const calculateOverallTrend = ({
  temperatureTrend,
  humidityTrend,
  rainTrend,
  windTrend
}) => {
  let score = 50;

  /*
   * Positive score = worsening conditions
   * Negative score = improving conditions
   */

  if (temperatureTrend.direction === "RISING") {
    score += 10;
  }

  if (temperatureTrend.direction === "FALLING") {
    score -= 10;
  }

  if (rainTrend.direction === "INCREASING") {
    score += 20;
  }

  if (rainTrend.direction === "DECREASING") {
    score -= 20;
  }

  if (windTrend.direction === "RISING") {
    score += 10;
  }

  if (windTrend.direction === "FALLING") {
    score -= 5;
  }

  if (humidityTrend.direction === "RISING") {
    score += 5;
  }

  if (humidityTrend.direction === "FALLING") {
    score -= 5;
  }

  score = clamp(score);

  let level = "STABLE";

  if (score >= 65) {
    level = "WORSENING";
  } else if (score <= 35) {
    level = "IMPROVING";
  }

  return {
    score: Math.round(score),
    level
  };
};

/**
 * Main Forecast Trend Agent
 */
export const analyzeForecastTrend = (
  forecastData
) => {
  if (
    !Array.isArray(forecastData) ||
    forecastData.length < 2
  ) {
    return {
      agent: {
        name: "Forecast Trend Agent",
        version: "1.0",
        status: "insufficient_data"
      },

      success: false,

      message:
        "At least two forecast records are required."
    };
  }

  // Sort forecast observations chronologically where timestamps exist
  const sortedForecast = [...forecastData].filter(item => item && typeof item === 'object').sort((a, b) => {
    const timeA = typeof a?.dt === "number" ? a.dt : 0;
    const timeB = typeof b?.dt === "number" ? b.dt : 0;
    return timeA - timeB;
  });

  if (sortedForecast.length < 2) {
    return {
      agent: {
        name: "Forecast Trend Agent",
        version: "1.0",
        status: "insufficient_data"
      },
      success: false,
      message: "At least two valid forecast records are required."
    };
  }

  const temperatureValues = sortedForecast.map(
    (item) => item?.main?.temp
  );

  const humidityValues = sortedForecast.map(
    (item) => item?.main?.humidity
  );

  const rainValues = sortedForecast.map(
    (item) =>
      isValidNumber(item?.pop)
        ? item.pop * 100
        : null
  );

  const windValues = sortedForecast.map(
    (item) => {
      if (!isValidNumber(item?.wind?.speed)) {
        return null;
      }

      return item.wind.speed * 3.6;
    }
  );

  const temperatureTrend =
    calculateTrend(
      temperatureValues,
      8
    );

  const humidityTrend =
    calculateTrend(
      humidityValues,
      10
    );

  const rainTrend =
    calculateRainTrend(
      rainValues
    );

  const windTrend =
    calculateTrend(
      windValues,
      15
    );

  const conditionAnalysis =
    analyzeWeatherConditions(
      sortedForecast
    );

  const overallTrend =
    calculateOverallTrend({
      temperatureTrend,
      humidityTrend,
      rainTrend,
      windTrend
    });

  const keyChanges =
    generateKeyChanges({
      temperatureTrend,
      humidityTrend,
      rainTrend,
      windTrend,
      conditionAnalysis
    });

  let recommendation;

  if (
    overallTrend.level === "WORSENING"
  ) {
    recommendation =
      "Weather conditions may become less favorable later in the forecast period.";
  } else if (
    overallTrend.level === "IMPROVING"
  ) {
    recommendation =
      "Weather conditions may become more favorable later in the forecast period.";
  } else {
    recommendation =
      "Weather conditions are relatively stable across the analyzed forecast period.";
  }

  return {
    agent: {
      name: "Forecast Trend Agent",
      version: "1.0",
      status: "completed"
    },

    forecastRecordsAnalyzed:
      forecastData.length,

    trends: {
      temperature: temperatureTrend,
      humidity: humidityTrend,
      rainProbability: rainTrend,
      wind: windTrend
    },

    weatherConditions:
      conditionAnalysis,

    overallTrend,

    keyChanges,

    recommendation
  };
};