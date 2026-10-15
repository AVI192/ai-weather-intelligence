const isValidNumber = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value)

const parseOptionalNumber = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  if (typeof value === 'boolean') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const clamp = (value, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max)

const getRiskLevel = (score) => {
  if (score >= 80) return 'VERY HIGH'
  if (score >= 60) return 'HIGH'
  if (score >= 35) return 'MODERATE'
  return 'LOW'
}

const normalizeRainProbability = (value) => {
  if (!isValidNumber(value)) {
    return null
  }

  // OpenWeather POP is normally 0–1.
  if (value >= 0 && value <= 1) {
    return value
  }

  // Also support percentage input.
  if (value > 1 && value <= 100) {
    return value / 100
  }

  return null
}

const calculateHeatRisk = ({
  temperature,
  feelsLike,
  humidity
}) => {
  if (
    !isValidNumber(temperature) ||
    !isValidNumber(humidity)
  ) {
    return {
      score: null,
      level: 'UNKNOWN',
      factors: [],
      explanation:
        'Insufficient temperature or humidity data.'
    }
  }

  const apparentTemperature =
    isValidNumber(feelsLike)
      ? Math.max(temperature, feelsLike)
      : temperature

  let score = 0
  const factors = []

  if (apparentTemperature >= 40) {
    score += 60
    factors.push('very high apparent temperature')
  } else if (apparentTemperature >= 35) {
    score += 45
    factors.push('high apparent temperature')
  } else if (apparentTemperature >= 30) {
    score += 30
    factors.push('high temperature')
  } else if (apparentTemperature >= 25) {
    score += 15
    factors.push('warm temperature')
  }

  if (humidity >= 80) {
    score += 35
    factors.push('very high humidity')
  } else if (humidity >= 70) {
    score += 25
    factors.push('high humidity')
  } else if (humidity >= 60) {
    score += 15
    factors.push('moderately high humidity')
  }

  return {
    score: clamp(score),
    level: getRiskLevel(clamp(score)),
    factors,
    explanation:
      factors.length
        ? `Heat-related risk is influenced by ${factors.join(
            ', '
          )}.`
        : 'No strong heat-related risk factors detected.'
  }
}

const calculateUVRisk = (uvIndex) => {
  if (!isValidNumber(uvIndex)) {
    return {
      score: null,
      level: 'UNKNOWN',
      factors: [],
      explanation: 'UV data is unavailable.'
    }
  }

  let score
  let explanation

  if (uvIndex >= 11) {
    score = 100
    explanation = 'Extreme UV exposure conditions detected.'
  } else if (uvIndex >= 8) {
    score = 80
    explanation = 'Very high UV exposure conditions detected.'
  } else if (uvIndex >= 6) {
    score = 60
    explanation = 'High UV exposure conditions detected.'
  } else if (uvIndex >= 3) {
    score = 35
    explanation = 'Moderate UV exposure conditions detected.'
  } else {
    score = 10
    explanation = 'Low UV exposure conditions detected.'
  }

  return {
    score,
    level: getRiskLevel(score),
    factors: [`UV index ${uvIndex}`],
    explanation
  }
}

const calculateRainRisk = ({
  rainProbability,
  condition
}) => {
  const probability =
    normalizeRainProbability(
      rainProbability
    )

  let score = 0
  const factors = []

  if (probability !== null) {
    if (probability >= 0.8) {
      score = 90
      factors.push('very high precipitation probability')
    } else if (probability >= 0.6) {
      score = 70
      factors.push('high precipitation probability')
    } else if (probability >= 0.4) {
      score = 50
      factors.push('moderate precipitation probability')
    } else if (probability >= 0.2) {
      score = 30
      factors.push('some precipitation probability')
    } else {
      score = 10
    }
  }

  if (/thunderstorm|storm/i.test(condition || '')) {
    score = Math.max(score, 90)
    factors.push('storm condition')
  } else if (/rain|drizzle/i.test(condition || '')) {
    score = Math.max(score, 60)
    factors.push('rain condition')
  }

  if (
    probability === null &&
    !factors.length
  ) {
    return {
      score: null,
      level: 'UNKNOWN',
      factors: [],
      explanation:
        'Precipitation information is unavailable.'
    }
  }

  return {
    score: clamp(score),
    level: getRiskLevel(clamp(score)),
    factors,
    explanation:
      factors.length
        ? `Precipitation risk is influenced by ${factors.join(
            ', '
          )}.`
        : 'No significant precipitation signal detected.'
  }
}

const calculateWindRisk = (windSpeed) => {
  if (!isValidNumber(windSpeed) || windSpeed < 0) {
    return {
      score: null,
      level: 'UNKNOWN',
      factors: [],
      explanation: !isValidNumber(windSpeed)
        ? 'Wind data is unavailable.'
        : 'Invalid wind speed measurement (negative value).'
    }
  }

  let score = 0

  if (windSpeed >= 60) {
    score = 100
  } else if (windSpeed >= 45) {
    score = 85
  } else if (windSpeed >= 30) {
    score = 65
  } else if (windSpeed >= 20) {
    score = 40
  } else if (windSpeed >= 10) {
    score = 20
  } else {
    score = 5
  }

  const roundedSpeed = Math.round(windSpeed * 10) / 10

  return {
    score: clamp(score),
    level: getRiskLevel(clamp(score)),
    factors:
      score >= 60
        ? [`strong wind (${roundedSpeed} km/h)`]
        : [],
    explanation:
      score >= 60
        ? 'Strong wind may significantly affect outdoor conditions.'
        : 'Wind is not currently a dominant risk factor.'
  }
}

const calculateVisibilityRisk = (
  visibilityKm
) => {
  if (!isValidNumber(visibilityKm)) {
    return {
      score: null,
      level: 'UNKNOWN',
      factors: [],
      explanation:
        'Visibility data is unavailable.'
    }
  }

  let score = 0

  if (visibilityKm < 1) {
    score = 100
  } else if (visibilityKm < 2) {
    score = 80
  } else if (visibilityKm < 5) {
    score = 60
  } else if (visibilityKm < 10) {
    score = 25
  } else {
    score = 5
  }

  return {
    score,
    level: getRiskLevel(score),
    factors:
      score >= 60
        ? [`reduced visibility (${visibilityKm} km)`]
        : [],
    explanation:
      score >= 60
        ? 'Reduced visibility may affect outdoor activities and travel.'
        : 'Visibility is not currently a dominant risk factor.'
  }
}
const detectInteractions = ({
  temperature,
  feelsLike: _feelsLike,
  humidity,
  windSpeed,
  uvIndex,
  rainProbability
}) => {
  const interactions = []

  /*
   * Heat + humidity + low wind
   */
  let hasHeatHumidityLowWind = false;
  if (
    isValidNumber(temperature) &&
    isValidNumber(humidity) &&
    isValidNumber(windSpeed) &&
    temperature >= 30 &&
    humidity >= 70 &&
    windSpeed < 10
  ) {
    hasHeatHumidityLowWind = true;
    interactions.push({
      type: 'heat-humidity-low-wind',
      severity: 'HIGH',
      impact: 20,
      explanation:
        'High temperature, high humidity, and low wind occur together, reducing the cooling effect of air movement.'
    })
  }

  /*
   * High heat + high UV
   */
  if (
    isValidNumber(temperature) &&
    isValidNumber(uvIndex) &&
    temperature >= 30 &&
    uvIndex >= 8
  ) {
    interactions.push({
      type: 'heat-uv',
      severity: 'HIGH',
      impact: 15,
      explanation:
        'High temperature and very high UV conditions occur together, increasing outdoor exposure burden.'
    })
  }

  /*
   * High heat + high humidity (avoid double-counting if heat-humidity-low-wind already triggered)
   */
  if (
    !hasHeatHumidityLowWind &&
    isValidNumber(temperature) &&
    isValidNumber(humidity) &&
    temperature >= 32 &&
    humidity >= 70
  ) {
    interactions.push({
      type: 'heat-humidity',
      severity: 'HIGH',
      impact: 15,
      explanation:
        'High temperature combined with high humidity can increase perceived thermal discomfort.'
    })
  }

  /*
   * Rain + wind
   */
  if (
    isValidNumber(rainProbability) &&
    isValidNumber(windSpeed) &&
    rainProbability >= 0.5 &&
    windSpeed >= 25
  ) {
    interactions.push({
      type: 'rain-wind',
      severity: 'HIGH',
      impact: 15,
      explanation:
        'Higher precipitation probability combined with strong wind may create more difficult outdoor conditions.'
    })
  }

  /*
   * Poor visibility + rain
   */
  if (
    isValidNumber(rainProbability) &&
    rainProbability >= 0.5
  ) {
    interactions.push({
      type: 'precipitation-activity',
      severity: 'MODERATE',
      impact: 10,
      explanation:
        'Elevated precipitation probability can increase disruption for outdoor activities.'
    })
  }

  return interactions
}
const ACTIVITY_PROFILES = {
  running: {
    temperature: 0.30,
    humidity: 0.20,
    rain: 0.20,
    wind: 0.15,
    uv: 0.10,
    visibility: 0.05
  },

  cycling: {
    temperature: 0.25,
    humidity: 0.15,
    rain: 0.25,
    wind: 0.20,
    uv: 0.10,
    visibility: 0.05
  },

  walking: {
    temperature: 0.25,
    humidity: 0.15,
    rain: 0.25,
    wind: 0.10,
    uv: 0.15,
    visibility: 0.10
  },

  cricket: {
    temperature: 0.25,
    humidity: 0.15,
    rain: 0.25,
    wind: 0.10,
    uv: 0.15,
    visibility: 0.10
  },

  travel: {
    temperature: 0.10,
    humidity: 0.05,
    rain: 0.30,
    wind: 0.20,
    uv: 0.05,
    visibility: 0.30
  },

  photography: {
    temperature: 0.10,
    humidity: 0.10,
    rain: 0.30,
    wind: 0.15,
    uv: 0.10,
    visibility: 0.25
  },

  driving: {
    temperature: 0.05,
    humidity: 0.05,
    rain: 0.30,
    wind: 0.20,
    uv: 0.05,
    visibility: 0.35
  },

  outdoor_event: {
    temperature: 0.20,
    humidity: 0.15,
    rain: 0.30,
    wind: 0.15,
    uv: 0.15,
    visibility: 0.05
  },

  swimming: {
    temperature: 0.15,
    humidity: 0.05,
    rain: 0.40,
    wind: 0.25,
    uv: 0.10,
    visibility: 0.05
  }
}

const getActivityProfile = (activity) => {
  const normalized =
    String(activity || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')

  return {
    name:
      ACTIVITY_PROFILES[normalized]
        ? normalized
        : 'general',

    weights:
      ACTIVITY_PROFILES[normalized] || {
        temperature: 0.20,
        humidity: 0.15,
        rain: 0.25,
        wind: 0.15,
        uv: 0.10,
        visibility: 0.15
      }
  }
}
const calculateActivityRisk = ({
  activity,
  heatRisk,
  uvRisk,
  rainRisk,
  windRisk,
  visibilityRisk,
  interactions
}) => {
  const profile =
    getActivityProfile(activity)

  const dimensionPairs = [
    { score: heatRisk?.score, weight: (profile.weights.temperature + profile.weights.humidity) },
    { score: rainRisk?.score, weight: profile.weights.rain },
    { score: windRisk?.score, weight: profile.weights.wind },
    { score: uvRisk?.score, weight: profile.weights.uv },
    { score: visibilityRisk?.score, weight: profile.weights.visibility }
  ]

  let weightedScoreSum = 0
  let totalValidWeight = 0

  for (const pair of dimensionPairs) {
    if (isValidNumber(pair.score)) {
      weightedScoreSum += pair.score * pair.weight
      totalValidWeight += pair.weight
    }
  }

  const interactionImpact =
    (interactions || []).reduce(
      (sum, interaction) =>
        sum + (interaction.impact || 0),
      0
    )

  const riskFactors = [
    ...(heatRisk?.factors || []),
    ...(uvRisk?.factors || []),
    ...(rainRisk?.factors || []),
    ...(windRisk?.factors || []),
    ...(visibilityRisk?.factors || [])
  ]

  if (totalValidWeight === 0) {
    return {
      activity: profile.name,
      score: null,
      level: 'UNKNOWN',
      riskFactors,
      interactionCount:
        (interactions || []).length,
      explanation:
        `Insufficient weather data to evaluate activity risk for ${profile.name.replace(
          /_/g,
          ' '
        )}.`
    }
  }

  const normalizedWeightedScore =
    weightedScoreSum / totalValidWeight

  let finalScore =
    clamp(
      Math.round(
        normalizedWeightedScore +
        interactionImpact
      )
    )

  // Open water swimming thunderstorm and severe weather hazard safety check
  if (profile.name === 'swimming') {
    const isThunderstorm = (rainRisk?.factors || []).some(f => /storm|thunderstorm/i.test(f)) ||
      /thunderstorm|storm|lightning/i.test(rainRisk?.explanation || '')
    if (isThunderstorm) {
      finalScore = Math.max(finalScore, 90)
    }
  }

  const level =
    getRiskLevel(finalScore)

  return {
    activity: profile.name,
    score: finalScore,
    level,
    riskFactors,
    interactionCount:
      (interactions || []).length,

    explanation:
      `Risk assessment for ${profile.name.replace(
        /_/g,
        ' '
      )} is ${level.toLowerCase()} based on activity-specific weather factors and detected weather interactions.`
  }
}
const calculateOverallRisk = ({
  heatRisk,
  uvRisk,
  rainRisk,
  windRisk,
  visibilityRisk,
  interactions
}) => {
  const risks = [
    heatRisk,
    uvRisk,
    rainRisk,
    windRisk,
    visibilityRisk
  ].filter(
    (risk) =>
      risk &&
      risk.score !== null
  )

  if (!risks.length) {
    return {
      score: null,
      level: 'UNKNOWN',
      explanation:
        'Insufficient weather information for an overall risk assessment.'
    }
  }

  const average =
    risks.reduce(
      (sum, risk) =>
        sum + risk.score,
      0
    ) / risks.length

  const interactionImpact =
    interactions.reduce(
      (sum, interaction) =>
        sum + interaction.impact,
      0
    )

  const score =
    clamp(
      Math.round(
        average +
        interactionImpact * 0.5
      )
    )

  const level =
    getRiskLevel(score)

  const dominantRisk =
    risks.reduce(
      (highest, risk) =>
        risk.score > highest.score
          ? risk
          : highest
    )

  return {
    score,
    level,

    dominantRisk: {
      level:
        dominantRisk.level,

      score:
        dominantRisk.score
    },

    interactionCount:
      interactions.length,

    explanation:
      `Overall weather risk is ${level.toLowerCase()}. The strongest individual risk is ${dominantRisk.level.toLowerCase()}, with ${interactions.length} cross-parameter interaction(s) detected.`
  }
}
export const analyzeWeatherRisk = (
  inputData = {},
  activityParam
) => {
  const isPositional =
    typeof inputData === 'object' &&
    inputData !== null &&
    !('current' in inputData) &&
    !('weather' in inputData) &&
    !('latitude' in inputData)

  const current = isPositional
    ? inputData
    : (inputData.current || inputData.weather || inputData)

  const uvIndex = isPositional
    ? (activityParam !== undefined ? activityParam : null)
    : (inputData.uvIndex ?? inputData.uv ?? null)

  const rainProbability = isPositional
    ? null
    : (inputData.rainProbability ?? null)

  const activity = isPositional
    ? (typeof activityParam === 'string' ? activityParam : 'general')
    : (inputData.activity || activityParam || 'general')

  const temperature = parseOptionalNumber(
    current?.temperatureCelsius ?? current?.temperature
  )

  const feelsLike = parseOptionalNumber(
    current?.feelsLikeCelsius ?? current?.feelsLike
  )

  const humidity = parseOptionalNumber(
    current?.humidityPercent ?? current?.humidity
  )

  const windSpeed = parseOptionalNumber(
    current?.windSpeedKmh ?? current?.windSpeed
  )

  const visibility = parseOptionalNumber(
    current?.visibilityKm ?? current?.visibility
  )

  const uv = parseOptionalNumber(
    uvIndex ?? current?.uvIndex ?? current?.uv
  )

  const rain = normalizeRainProbability(
    parseOptionalNumber(
      rainProbability ?? current?.rainProbability
    )
  )

  const heatRisk =
    calculateHeatRisk({
      temperature,
      feelsLike,
      humidity
    })

  const uvRisk =
    calculateUVRisk(uv)

  const rainRisk =
    calculateRainRisk({
      rainProbability: rain,
      condition: current?.condition || current?.weatherCondition
    })

  const windRisk =
    calculateWindRisk(windSpeed)

  const visibilityRisk =
    calculateVisibilityRisk(
      visibility
    )

  const interactions =
    detectInteractions({
      temperature,
      feelsLike,
      humidity,
      windSpeed,
      uvIndex: uv,
      rainProbability: rain
    })

  const overallRisk =
    calculateOverallRisk({
      heatRisk,
      uvRisk,
      rainRisk,
      windRisk,
      visibilityRisk,
      interactions
    })

  const activityRisk =
    calculateActivityRisk({
      activity,
      heatRisk,
      uvRisk,
      rainRisk,
      windRisk,
      visibilityRisk,
      interactions
    })

  const isUnknown =
    activityRisk.level === 'UNKNOWN' ||
    overallRisk.level === 'UNKNOWN'

  return {
    agent: {
      name: 'Risk Intelligence Agent',
      version: '2.0.0',
      status: 'completed'
    },

    assessmentContext: {
      activity:
        activity || 'general'
    },

    risks: {
      heat: heatRisk,
      uv: uvRisk,
      rain: rainRisk,
      wind: windRisk,
      visibility: visibilityRisk
    },

    interactions,

    overallRisk,

    activityRisk,

    decision: {
      cautionRequired:
        overallRisk.level === 'HIGH' ||
        overallRisk.level === 'VERY HIGH' ||
        isUnknown,

      recommendation:
        isUnknown
          ? `Insufficient weather data to evaluate conditions for ${activity}. Proceed with caution.`
          : activityRisk.level === 'VERY HIGH'
            ? `Conditions are highly unfavorable for ${activity}. Consider postponing or choosing a better weather window.`
            : activityRisk.level === 'HIGH'
              ? `Conditions may be challenging for ${activity}. Consider a safer or more suitable time.`
              : activityRisk.level === 'MODERATE'
                ? `Conditions are manageable for ${activity} with reasonable precautions.`
                : `Current conditions are relatively favorable for ${activity}.`
    }
  }
}