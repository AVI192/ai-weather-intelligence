import { Router } from "express";
import { searchLocations } from "../services/openWeatherService.js";
import { buildCityAnalyses } from "../agents/orchestratorAgent.js";
import { analyzeCityIntelligence } from "../agents/cityIntelligenceAgent.js";

const router = Router();

// Diverse candidate pool across multiple global climate zones for AI recommendations
const DEFAULT_RECOMMENDATION_POOL = [
  "London",
  "Paris",
  "Tokyo",
  "New York",
  "Sydney",
  "Barcelona",
  "Dubai",
  "Singapore"
];

/**
 * GET /api/city/recommendations
 * Recommends top cities for a specified activity based on real-time weather,
 * forecast trends, activity suitability, and hazards.
 */
router.get("/recommendations", async (req, res) => {
  try {
    const activity = req.query.activity || "sightseeing";

    const candidateAnalyses = await buildCityAnalyses(
      DEFAULT_RECOMMENDATION_POOL,
      activity
    );

    if (!candidateAnalyses || candidateAnalyses.length < 2) {
      return res.status(503).json({
        success: false,
        message: "Unable to retrieve sufficient candidate weather data for AI recommendations."
      });
    }

    const result = analyzeCityIntelligence({
      cities: candidateAnalyses,
      activity
    });

    res.json({
      success: true,
      mode: "AI_RECOMMENDED",
      activity,
      candidatesEvaluated: candidateAnalyses.length,
      data: result
    });
  } catch (error) {
    console.error("AI City Recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI city recommendations.",
      error: error.message
    });
  }
});

/**
 * Handle Multi-City Comparison (POST and GET)
 * Compares 2 to 5 user-chosen or selected cities using real telemetry.
 */
const handleCompareCities = async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    let cities = params.cities;
    const activity = params.activity || "general";

    if (typeof cities === "string") {
      cities = cities.split(",").map(c => c.trim()).filter(Boolean);
    }

    if (!Array.isArray(cities) || cities.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least two distinct cities are required for comparison."
      });
    }

    // Deduplicate while preserving order
    const uniqueCities = [...new Set(cities.map(c => c.trim()))].filter(Boolean);
    if (uniqueCities.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please select at least two different cities for comparison."
      });
    }

    if (uniqueCities.length > 5) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 5 cities can be compared concurrently."
      });
    }

    const analyses = await buildCityAnalyses(uniqueCities, activity);

    if (!analyses || analyses.length < 2) {
      return res.status(503).json({
        success: false,
        message: "Could not retrieve live meteorological data for at least two of the selected cities. Please verify the city names."
      });
    }

    const result = analyzeCityIntelligence({
      cities: analyses,
      activity
    });

    res.json({
      success: true,
      mode: "MULTI_CITY_COMPARISON",
      activity,
      citiesCompared: analyses.length,
      data: result
    });
  } catch (error) {
    console.error("Multi-City Comparison error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute multi-city comparison.",
      error: error.message
    });
  }
};

router.post("/compare", handleCompareCities);
router.get("/compare", handleCompareCities);

/**
 * GET /api/city/city-comparison
 * Legacy endpoint support for 2-city queries (?city1=...&city2=...)
 */
router.get("/city-comparison", async (req, res) => {
  try {
    const { city1, city2, activity = "general" } = req.query;

    if (!city1 || !city2) {
      return res.status(400).json({
        success: false,
        message: "city1 and city2 are required."
      });
    }

    const analyses = await buildCityAnalyses([city1, city2], activity);

    if (!analyses || analyses.length < 2) {
      return res.status(400).json({
        success: false,
        message: `Could not retrieve live weather data for ${city1} or ${city2}.`
      });
    }

    const result = analyzeCityIntelligence({
      cities: analyses,
      activity
    });

    res.json({
      success: true,
      location: {
        city1: analyses[0].city,
        city2: analyses[1].city
      },
      data: result
    });
  } catch (error) {
    console.error("City Intelligence comparison error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to analyze city comparison.",
      error: error.message
    });
  }
});

/**
 * GET /api/city/search?q=...
 * Autocomplete search for manual city selection
 */
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || req.query.query || "";
    if (!query || query.trim().length < 2) {
      return res.json({ success: true, results: [] });
    }

    const locations = await searchLocations(query.trim());
    const formatted = (locations || []).slice(0, 6).map(loc => ({
      name: loc.name,
      country: loc.country || "",
      state: loc.state || "",
      lat: loc.lat,
      lon: loc.lon,
      label: `${loc.name}${loc.state ? `, ${loc.state}` : ""}${loc.country ? `, ${loc.country}` : ""}`
    }));

    res.json({
      success: true,
      results: formatted
    });
  } catch (error) {
    console.error("City search error:", error);
    res.status(500).json({
      success: false,
      message: "City search failed.",
      error: error.message
    });
  }
});

export default router;
