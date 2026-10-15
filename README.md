# 🌤️ AI Weather Intelligence & Decision Support System

An intelligent, multi-agent weather analytics and autonomous decision support platform. Instead of presenting raw numbers alone, this system synthesizes real-time meteorological telemetry through coordinated AI agents to provide actionable recommendations for daily activities, outdoor plans, safety risks, and travel.

---

## 📌 Project Overview & Basic Idea

Traditional weather apps only display isolated statistics—temperatures, percentages, and icons—leaving users to deduce whether conditions are safe or ideal for their specific plans. 

**AI Weather Intelligence** bridges that gap:
- **Natural Language Interaction**: Users ask real-world questions (e.g., *"Should I go running today?"*, *"Is it safe for cycling this afternoon?"*, or *"Compare weather in London and Paris for sightseeing"*).
- **Autonomous Multi-Agent Orchestration**: A central AI Orchestrator interprets user intent and delegates tasks across specialized agents (Data Quality, Risk Assessment, Forecast Trends, Activity Decision, and Reasoning).
- **Actionable Guidance**: The system evaluates compound environmental risks (such as high heat combined with humidity or rain probability with gusty winds) and outputs an **Executive Decision Verdict**, suitability scores (0–100), risk gauges, and trajectory forecasts.

---

## ⚙️ How It Works (System Architecture & Workflow)

```
       ┌────────────────────────────────────────────────────────┐
       │             User Query / Activity Question              │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │              AI Weather Orchestrator Agent             │
       │  • Natural language intent recognition                 │
       │  • Activity & entity extraction                        │
       │  • Dynamic execution plan generation                   │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │           1. Data Intelligence Agent (Quality Gate)     │
       │  • Validates live OpenWeather sensor inputs            │
       │  • Checks completeness & telemetry integrity           │
       └───────────────────────────┬────────────────────────────┘
                                   │ Passed (>80% Quality Gate)
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌──────────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│ 2. Risk Agent    │     │ 3. Trend Agent    │     │ 4. Reasoning Agent  │
│ • Heat / Thermal │     │ • 40-step horizon │     │ • Bio-comfort model │
│ • UV Radiation   │     │ • Trend deltas    │     │ • Atmospheric       │
│ • Rain & Wind    │     │ • Trajectory      │     │   observations      │
│ • Visibility     │     │   (Worsening /    │     └─────────────────────┘
│ • Cross-effects  │     │    Improving)     │
└────────┬─────────┘     └─────────┬─────────┘
         │                         │
         └────────────┬────────────┘
                      ▼
       ┌────────────────────────────────────────────────────────┐
       │              5. Activity Decision Agent                │
       │  • Calculates Suitability Score (0–100)                │
       │  • Adjusts for forward forecast trajectory             │
       │  • Generates Favorable vs. Caution factor breakdown    │
       │  • Produces clear Natural-Language Recommendation      │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │           Executive Frontend Results Dashboard         │
       │  • Hero Verdict Card & One-Click Copy                  │
       │  • 4 KPI Metric Cards (Suitability, Risk, Trend, Data) │
       │  • Categorized Tabs: Risk Radar, Shifts, Comfort, JSON │
       └────────────────────────────────────────────────────────┘
```

### Detailed Agent Roles:

1. **AI Orchestrator (`orchestratorAgent.js`)**:
   - Parses the user prompt, determines the primary intent (activity check, risk assessment, general forecast, or city comparison), selects the active city coordinates, and maps out an optimal agent execution plan.
2. **Data Intelligence Agent (`dataIntelligenceAgent.js`)**:
   - Acts as a quality gatekeeper. Validates numerical ranges for temperature, humidity, wind, UV, and pressure. Ensures data sufficiency before allowing downstream AI computations.
3. **Risk Intelligence Agent (`riskIntelligenceAgent.js`)**:
   - Computes weighted risk indices across 5 dimensions: **Heat Stress**, **UV Exposure**, **Precipitation**, **Wind Velocity**, and **Visibility**.
   - Detects complex parameter interactions (e.g., moderate heat + high humidity = heightened thermal exhaustion hazard).
4. **Forecast Trend Agent (`forecastTrendAgent.js`)**:
   - Ingests 40 multi-hour forecast records to calculate moving slopes, identifying whether conditions are **IMPROVING**, **STABLE**, or **WORSENING**, and pinpointing exact shifts in temperature, rain chance, and wind.
5. **Activity Decision Agent (`activityDecisionAgent.js`)**:
   - Combines activity risk with the forecast trend offset to classify suitability:
     - `EXCELLENT` (≥80) • `GOOD` (≥65) • `MODERATE` (≥45) • `POOR` (≥25) • `UNSUITABLE` (<25)
   - Compiles positive green-flag factors, cautionary watch points, and final actionable advice.
6. **Weather Reasoning Agent (`weatherReasoningAgent.js`)**:
   - Performs thermal comfort modeling (`Comfortable`, `Cool`, `Uncomfortable`, `Very Uncomfortable`) and explains physiological sensations.
7. **City Intelligence Agent (`cityIntelligenceAgent.js`)**:
   - Ranks multiple destinations side-by-side for travel and event planning, spotlighting winner margins.
8. **Live Groq LLM Intelligence Agent (`groqService.js`)**:
   - Synthesizes composite meteorological telemetry into actionable natural-language executive verdicts, optimal time windows, clothing & gear recommendations, and powers the interactive multi-turn Live AI Copilot.

---

## 💻 Tech Stack

- **Frontend**:
  - React 19 + Vite 7
  - Lucide React (Visual icon system)
  - Recharts (Interactive temperature, humidity, and distribution charts)
  - Custom CSS Design System (Tailored blue palette with Dark & Light theme tokens)
- **Backend**:
  - Node.js (ES Modules)
  - Express 5
  - Groq SDK (`groq-sdk` with LLaMA 3.3 70B Versatile inference)
  - OpenWeatherMap API (Current weather, 5-day / 3-hour forecasts, Geocoding)
  - Multi-Agent Orchestration Engine (Data, Risk, Trend, Activity, City, Reasoning, Groq LLM)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `20.19+` or `22.12+`
- An [OpenWeatherMap API key](https://openweathermap.org/api)
- *(Optional for Live Groq AI)* A [free Groq API key](https://console.groq.com/keys)

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
OPENWEATHER_API_KEY=your_openweather_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Frontend (`.env`):**
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### 3. Run the Backend (Terminal 1)
```powershell
cd backend
npm install
npm run dev
```
Backend will be available at: `http://localhost:5000`

### 4. Run the Frontend (Terminal 2)
```powershell
# From the project root
npm install
npm run dev
```
Open the printed Vite URL in your browser (typically `http://localhost:5173`).

---

## 📡 Key Orchestrator API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/orchestrator/route?query=...&lat=...&lon=...` | Generates the orchestration execution plan. |
| `GET` | `/api/orchestrator/execute?query=...&lat=...&lon=...` | Executes multi-agent analysis for a given query and coordinates. |
| `POST` | `/api/orchestrator/execute` | Executes analysis with a JSON payload (`query`, `lat`, `lon`, `activity`). |
| `GET` | `/api/llm/status` | Checks Groq LLM configuration status and active model. |
| `POST` | `/api/llm/chat` | Multi-turn conversational chat with Groq Live Weather AI. |
| `POST` | `/api/llm/insight` | Standalone Groq LLM evaluation for custom weather payloads. |
| `GET` | `/api/weather/current?city=...` | Fetches normalized current weather conditions. |
| `GET` | `/api/weather/forecast?lat=...&lon=...` | Fetches 5-day / 3-hour forecast telemetry. |

---

## 🛡️ Security Best Practices
- Never commit `.env` files with secret API keys. Keep all keys server-side in `backend/.env`.
- Frontend code only interacts through the proxy backend server or exposed non-secret Vite variables.
