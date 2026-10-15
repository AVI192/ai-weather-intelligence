import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import healthRoutes from './routes/healthRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js'
import reasoningRoutes from './routes/reasoningRoutes.js'
import riskRoutes from "./routes/riskRoutes.js";
import trendRoutes from "./routes/trendRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import cityRoutes from "./routes/cityRoutes.js";
import orchestratorRoutes from "./routes/orchestratorRoutes.js";
import llmRoutes from "./routes/llmRoutes.js";
dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL =
  process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI Weather backend is running'
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/weather', weatherRoutes);
app.use(
  '/api/intelligence',
  intelligenceRoutes
)
app.use(
  '/api/reasoning',
  reasoningRoutes
)
app.use("/api/risk", riskRoutes);
app.use("/api/trend", trendRoutes);
app.use(
  "/api/activity",
  activityRoutes
);
app.use("/api/city", cityRoutes);
app.use("/api/orchestrator", orchestratorRoutes);
app.use("/api/llm", llmRoutes);
app.use((err, req, res, _next) => {
  console.error('Backend Error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(
    `AI Weather backend running at http://localhost:${PORT}`
  );
});