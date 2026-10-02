import { useState } from "react";
import { Languages, MessageCircle, Sparkles } from "lucide-react";

import { generateAIClosure, translateIncidentText } from "../api";

const LANGUAGES = [
  "Hindi",
  "Marathi",
  "English",
];

export function AITranslationCard({ issue, user, text }) {
  const [language, setLanguage] = useState("Hindi");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function translate() {
    if (!issue?.id || !text?.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResult(
        await translateIncidentText(
          issue.id,
          user.id,
          text,
          language,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="citizen-ai-tool-card">
      <div className="citizen-ai-tool-head">
        <Languages size={15} />
        <strong>Language assist</strong>
      </div>
      <p>Translate the AI summary for easier sharing with family or local responders.</p>
      <div className="citizen-ai-tool-row">
        <select value={language} onChange={(event) => setLanguage(event.target.value)}>
          {LANGUAGES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="tiny-action-button" onClick={translate} disabled={loading}>
          {loading ? "Translating..." : "Translate"}
        </button>
      </div>
      {result ? <div className="citizen-ai-output">{result.translated_text}<small>{result.ai_status}</small></div> : null}
      {error ? <div className="citizen-ai-error">{error}</div> : null}
    </div>
  );
}

export function AIClosureCard({ issue, user }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!issue?.id || issue.status !== "RESOLVED") return;
    setLoading(true);
    setError("");
    try {
      setResult(await generateAIClosure(issue.id, user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (issue?.status !== "RESOLVED") return null;

  return (
    <div className="citizen-ai-tool-card closure-card">
      <div className="citizen-ai-tool-head">
        <MessageCircle size={15} />
        <strong>AI resolution message</strong>
      </div>
      <p>Generate a clear citizen-facing summary for this resolved report.</p>
      <button type="button" className="tiny-action-button" onClick={generate} disabled={loading}>
        <Sparkles size={13} /> {loading ? "Generating..." : "Generate message"}
      </button>
      {result ? (
        <div className="citizen-ai-output">
          <strong>{result.closure_title}</strong>
          <p>{result.citizen_message}</p>
          <small>{result.resolution_summary}</small>
        </div>
      ) : null}
      {error ? <div className="citizen-ai-error">{error}</div> : null}
    </div>
  );
}
