import { Router } from "express";

import {
  orchestrateWeatherQuery,
  executeOrchestratedQuery
} from "../agents/orchestratorAgent.js";

const router = Router();

router.get("/route", async (req, res) => {
  try {
    const {
      query,
      lat,
      lon
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "query is required."
      });
    }

    const latitude =
      lat !== undefined
        ? Number(lat)
        : null;

    const longitude =
      lon !== undefined
        ? Number(lon)
        : null;

    const result =
      orchestrateWeatherQuery({
        query,
        latitude,
        longitude
      });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(
      "Orchestrator error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to process orchestration request.",
      error: error.message
    });
  }
});

const handleExecute = async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const {
      query = "",
      lat,
      lon,
      current,
      forecast,
      uvData,
      activity,
      cityAnalyses,
      cities
    } = params;

    const parsedLat = Number(lat);
    const parsedLon = Number(lon);

    const latitude = Number.isFinite(parsedLat) ? parsedLat : null;
    const longitude = Number.isFinite(parsedLon) ? parsedLon : null;

    const headerKey = req.headers['x-groq-api-key'];
    const activeApiKey = params.apiKey || headerKey || null;

    const result = await executeOrchestratedQuery({
      query,
      latitude,
      longitude,
      current,
      forecast,
      uvData,
      activity,
      cityAnalyses,
      cities,
      apiKey: activeApiKey
    });

    if (result.success === false) {
      if (result.dataQuality) {
        return res.json({
          success: true,
          data: {
            ...result,
            status: 'insufficient_data'
          }
        });
      }
      return res.status(400).json({
        success: false,
        message: result.message || "Orchestration analysis could not be completed.",
        data: result
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Orchestrator execute error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to execute orchestration plan.",
      error: error.message
    });
  }
};

router.get("/execute", handleExecute);
router.post("/execute", handleExecute);

export default router;