const clamp = (value, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

const getClassification = (score) => {
  if (score >= 80) return "EXCELLENT";
  if (score >= 65) return "GOOD";
  if (score >= 45) return "MODERATE";
  if (score >= 25) return "POOR";
  return "UNSUITABLE";
};

export const ACTIVITY_PROFILES = {
  running: { category: "cardio", primaryRisk: "heat", idealTempRange: [12, 22] },
  cycling: { category: "aerobic", primaryRisk: "wind", idealTempRange: [15, 25] },
  hiking: { category: "endurance", primaryRisk: "rain", idealTempRange: [10, 24] },
  swimming: { category: "aquatic", primaryRisk: "uv", idealTempRange: [24, 34] },
  photography: { category: "creative", primaryRisk: "visibility", idealTempRange: [5, 28] },
  stargazing: { category: "astronomy", primaryRisk: "clouds", idealTempRange: [5, 22] },
  outdoor_dining: { category: "leisure", primaryRisk: "rain", idealTempRange: [18, 27] }
};

const getTrendAdjustment = (trend) => {
  if (!trend) return 0;

  if (trend.level === "IMPROVING") {
    return 5;
  }

  if (trend.level === "WORSENING") {
    return -5;
  }

  return 0;
};

const getRiskFactors = (risks) => {
  const positive = [];
  const negative = [];

  Object.entries(risks || {}).forEach(
    ([factor, data]) => {
      const rawScore = data?.score;

      if (
        rawScore === null ||
        rawScore === undefined ||
        rawScore === "" ||
        typeof rawScore === "boolean" ||
        !Number.isFinite(Number(rawScore))
      ) {
        return;
      }

      const score = Number(rawScore);

      const name =
        factor.charAt(0).toUpperCase() +
        factor.slice(1);

      if (score <= 20) {
        positive.push(
          `Low ${name} risk`
        );
      }

      if (score >= 60) {
        negative.push(
          `High ${name} risk`
        );
      }
    }
  );

  return {
    positive,
    negative
  };
};

const generateRecommendation = ({
  activity,
  classification,
  score,
  trendLevel,
  negativeFactors: _negativeFactors,
  interactions: _interactions
}) => {
  const isSwimming = activity.toLowerCase() === "swimming";

  if (isSwimming) {
    if (classification === "POOR" || classification === "UNSUITABLE" || score < 50) {
      return `Outdoor swimming is not recommended under current atmospheric conditions. Note: Essential water safety factors (currents, tides, rip currents, water temperature, and water quality) are not monitored by atmospheric sensors and must be checked on-site.`;
    }
    return `Atmospheric weather conditions appear suitable for outdoor swimming. Important safety limitation: Water conditions (temperature, currents, tides, rip currents, and local lifeguard warnings) are NOT monitored by weather stations and must be verified locally before swimming.`;
  }

  if (classification === "EXCELLENT") {
    return `${activity} appears highly suitable under the analyzed conditions.`;
  }

  if (classification === "GOOD") {
    if (trendLevel === "WORSENING") {
      return `${activity} is currently suitable, but conditions may become less favorable later.`;
    }

    return `${activity} appears suitable under the analyzed conditions with normal precautions.`;
  }

  if (classification === "MODERATE") {
    return `${activity} is possible, but consider the identified weather factors before proceeding.`;
  }

  if (classification === "POOR") {
    return `Consider postponing ${activity} or choosing a more favorable time window.`;
  }

  return `The analyzed conditions are not favorable for ${activity}.`;
};

export const analyzeActivityDecision = ({
  activity = "general",
  riskResult,
  trendResult
}) => {
  if (!riskResult) {
    return {
      agent: {
        name: "Activity Decision Agent",
        version: "1.0",
        status: "failed"
      },

      success: false,

      message:
        "Risk assessment data is required."
    };
  }

  const activityRisk =
    riskResult.activityRisk;

  if (!activityRisk) {
    return {
      agent: {
        name: "Activity Decision Agent",
        version: "1.0",
        status: "failed"
      },

      success: false,

      message:
        "Activity-specific risk data is missing."
    };
  }

  const rawRiskScore = activityRisk?.score;

  const isInvalidScore =
    rawRiskScore === null ||
    rawRiskScore === undefined ||
    rawRiskScore === "" ||
    typeof rawRiskScore === "boolean" ||
    !Number.isFinite(Number(rawRiskScore)) ||
    Number(rawRiskScore) < 0 ||
    Number(rawRiskScore) > 100;

  if (isInvalidScore) {
    return {
      agent: {
        name: "Activity Decision Agent",
        version: "1.0",
        status: "failed"
      },

      success: false,

      message:
        "Valid activity-specific risk score is required."
    };
  }

  const riskScore = Number(rawRiskScore);

  const baseSuitability =
    100 - riskScore;

  const trendLevel =
    trendResult?.overallTrend?.level ||
    "STABLE";

  const trendAdjustment =
    getTrendAdjustment(
      trendResult?.overallTrend
    );

  const isSwimming = activity.toLowerCase() === "swimming";

  const rawCalculatedScore = Math.round(
    clamp(
      baseSuitability +
        trendAdjustment
    )
  );

  // For swimming: water quality, rip currents, tides, and water temperature are unmonitored by atmospheric stations.
  // We do not invent safety measurements or automatically produce an unverified EXCELLENT (>=80) score.
  let finalScore = isSwimming && rawCalculatedScore > 75 ? 75 : rawCalculatedScore;

  // Severe swimming hazard override: A known severe weather hazard (thunderstorm, storm, rain risk >= 70, or wind risk >= 70)
  // cannot be overridden by favorable temperatures or positive trends. Clamped to <= 20 to guarantee an UNSUITABLE classification (< 25).
  const hasSevereSwimmingHazard = isSwimming && (
    riskScore >= 70 ||
    riskResult?.risks?.rain?.score >= 70 ||
    riskResult?.risks?.wind?.score >= 70 ||
    (riskResult?.risks?.rain?.factors || []).some(f => /storm|thunderstorm|lightning/i.test(f))
  );

  if (hasSevereSwimmingHazard) {
    finalScore = Math.min(finalScore, 20);
  }

  const classification =
    getClassification(
      finalScore
    );

  const factorAnalysis =
    getRiskFactors(
      riskResult.risks
    );

  const interactions =
    riskResult.interactions || [];

  const recommendation =
    generateRecommendation({
      activity,
      classification,
      score: finalScore,
      trendLevel,
      negativeFactors:
        factorAnalysis.negative,
      interactions
    });

  return {
    agent: {
      name: "Activity Decision Agent",
      version: "1.0",
      status: "completed"
    },

    activity,
    profile: ACTIVITY_PROFILES[activity.toLowerCase()] || { category: "general", primaryRisk: "overall" },

    suitability: {
      score: finalScore,
      classification
    },

    safetyLimitations: isSwimming
      ? [
          "Atmospheric telemetry only: Water temperature, currents, tides, rip currents, surf conditions, and local water quality/lifeguard warnings are not monitored by weather sensors and must be verified on-site."
        ]
      : [],

    riskAssessment: {
      activityRiskScore: riskScore,
      activityRiskLevel:
        activityRisk.level,

      overallRiskScore:
        riskResult.overallRisk?.score ??
        null,

      overallRiskLevel:
        riskResult.overallRisk?.level ??
        null
    },

    forecastContext: {
      trendLevel,
      trendScore:
        trendResult?.overallTrend?.score ??
        null,

      trendAdjustment
    },

    factors: {
      positive:
        factorAnalysis.positive,

      negative:
        factorAnalysis.negative
    },

    interactions,

    decision: {
      recommendation,

      cautionRequired:
        finalScore < 65
    }
  };
};