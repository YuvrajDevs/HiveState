# ⬢ HiveState
### Autonomous Multi-Agent Orchestration & Financial Governance Platform

HiveState is a high-performance orchestration layer designed for complex, multi-agent AI ecosystems. Built on **Next.js 16** and powered by **Google Gemini** and **Supabase**, it provides a sensory-rich, low-latency environment for managing autonomous workflows with built-in financial guardrails and real-time observability.

---

## 🚀 Vision
In an era of agentic proliferation, HiveState acts as the "Central Intelligence Agency" for your AI clusters. It solves the fragmentation of disparate agents by providing a unified canvas for:
- **Resilient Execution**: Multi-step pipeline processing with automatic retries and error handling.
- **Financial Governance**: Real-time cost tracking, token budget management, and circuit breakers.
- **HITL Integration**: Seamless Human-In-The-Loop interrupts for high-stakes decision points.
- **Deep Observability**: Millisecond-level traces of internal agent reasoning and system outcomes.

## 🛠 Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Framer Motion (Interactions), TailwindCSS 4.
- **Backend**: Supabase (Postgres, Realtime, Auth).
- **Intelligence**: Google Generative AI (Gemini 2.5 Flash / Pro).
- **Canvas**: XYFlow (React Flow) for visual logic mapping.

## 📦 Getting Started

### Prerequisites
- Node.js 20+
- Supabase Project
- Google Gemini API Key

### Configuration
Create a `.env.local` file in the root directory:

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Intelligence
GEMINI_API_KEY=your_gemini_api_key
```

### Installation
```bash
npm install
npm run dev
```

## 🏗 Architecture
HiveState separates the **Orchestration Logic** from the **Execution Layer**:
1. **Workflows**: Visual or code-defined blueprints of agent connections.
2. **Agents**: Specialized prompt-engineered units assigned to specific tasks.
3. **Runs/Traces**: The live execution history, tracking every token and dollar spent.

## 🔒 Security & Privacy
- **Encrypted Credentials**: API keys are handled server-side and никогда (never) exposed to the client in raw form.
- **Governance Settings**: Global circuit breakers to prevent rogue agent spend.

---

Built with precision for the next generation of Agentic AI.
