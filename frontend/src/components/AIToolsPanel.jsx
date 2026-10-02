import { useState } from "react";
import {
  BrainCircuit,
  Globe2,
  Layers3,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

import {
  askAICivicAssistant,
  generateAIAreaBrief,
  generateAIClusters,
  generateAIResponseBrief,
  reanalyzeIssue,
} from "../api";

export default function AIToolsPanel({ user, selectedIssue, onIssueUpdated }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [areaBrief, setAreaBrief] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [responseBrief, setResponseBrief] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function askAssistant() {
    if (!question.trim()) return;
    setBusy("ask");
    setError("");
    try {
      setAnswer(await askAICivicAssistant(user.id, question.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function createAreaBrief() {
    setBusy("area");
    setError("");
    try {
      setAreaBrief(await generateAIAreaBrief(user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function createClusters() {
    setBusy("clusters");
    setError("");
    try {
      setClusters(await generateAIClusters(user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function createResponseBrief() {
    if (!selectedIssue) return;
    setBusy("brief");
    setError("");
    try {
      setResponseBrief(
        await generateAIResponseBrief(selectedIssue.id, user.id),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function rerunAnalysis() {
    if (!selectedIssue) return;
    setBusy("reanalyze");
    setError("");
    try {
      const updated = await reanalyzeIssue(selectedIssue.id, user.id);
      onIssueUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="dashboard-panel ai-studio-panel">
      <div className="ai-studio-heading">
        <div className="ai-admin-icon"><BrainCircuit size={19} /></div>
        <div>
          <span className="powered-label">OLLAMA AI DESK</span>
          <h2>More intelligence, controlled by the backend</h2>
        </div>
      </div>

      {error ? <div className="ai-studio-error">{error}</div> : null}

      <div className="ai-tool-grid">
        <div className="ai-tool-card wide">
          <div className="ai-tool-title">
            <MessageSquareText size={17} />
            <strong>Civic assistant</strong>
          </div>
          <p>Ask about the current incident data. The model receives a live database context.</p>
          <div className="ai-question-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") askAssistant();
              }}
              placeholder="How many unresolved vehicle accidents are there?"
            />
            <button type="button" className="blue-button" onClick={askAssistant} disabled={busy === "ask"}>
              {busy === "ask" ? "Thinking..." : "Ask"}
            </button>
          </div>
          {answer ? (
            <div className="ai-output-box">
              <strong>{answer.answer}</strong>
              {answer.data_points?.length ? (
                <ul>{answer.data_points.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : null}
              <small>{answer.ai_status}</small>
            </div>
          ) : null}
        </div>

        <div className="ai-tool-card">
          <div className="ai-tool-title"><Globe2 size={17} /><strong>Area brief</strong></div>
          <p>Summarize active incident pressure and recurring concerns.</p>
          <button type="button" className="ai-tool-button" onClick={createAreaBrief} disabled={busy === "area"}>
            {busy === "area" ? "Generating..." : "Generate area brief"}
          </button>
          {areaBrief ? (
            <div className="ai-output-box">
              <strong>{areaBrief.summary}</strong>
              <small>Concerns: {areaBrief.top_concerns.join(" • ") || "None"}</small>
              <small>Focus: {areaBrief.recommended_focus.join(" • ") || "None"}</small>
            </div>
          ) : null}
        </div>

        <div className="ai-tool-card">
          <div className="ai-tool-title"><Layers3 size={17} /><strong>Incident clusters</strong></div>
          <p>Group active incidents into useful thematic patterns.</p>
          <button type="button" className="ai-tool-button" onClick={createClusters} disabled={busy === "clusters"}>
            {busy === "clusters" ? "Clustering..." : "Find clusters"}
          </button>
          {clusters ? (
            <div className="ai-output-box">
              {clusters.clusters?.length ? clusters.clusters.map((cluster) => (
                <div className="cluster-row" key={cluster.name}>
                  <strong>{cluster.name}</strong>
                  <span>{cluster.issue_ids.map((id) => `#${id}`).join(", ")}</span>
                  <small>{cluster.summary}</small>
                </div>
              )) : <small>No useful cluster was produced.</small>}
            </div>
          ) : null}
        </div>
      </div>

      {selectedIssue ? (
        <div className="ai-selected-tools">
          <div>
            <span className="powered-label">SELECTED INCIDENT #{selectedIssue.id}</span>
            <strong>Run AI again or create a response brief</strong>
          </div>
          <div className="ai-selected-tool-buttons">
            <button type="button" className="ai-tool-button" onClick={rerunAnalysis} disabled={busy === "reanalyze"}>
              <Sparkles size={14} /> {busy === "reanalyze" ? "Analyzing..." : "Re-analyze"}
            </button>
            <button type="button" className="ai-tool-button" onClick={createResponseBrief} disabled={busy === "brief"}>
              <Sparkles size={14} /> {busy === "brief" ? "Generating..." : "Response brief"}
            </button>
          </div>
        </div>
      ) : null}

      {responseBrief ? (
        <div className="ai-brief-card expanded">
          <div className="ai-brief-risk">Risk level: <strong>{responseBrief.risk_level}</strong></div>
          <strong>Response actions</strong>
          <ul>{responseBrief.response_actions.map((action, index) => <li key={index}>{action}</li>)}</ul>
          <div className="ai-brief-message">Citizen message: {responseBrief.citizen_message}</div>
        </div>
      ) : null}
    </section>
  );
}
