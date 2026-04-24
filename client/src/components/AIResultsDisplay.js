import React from 'react';
import { FiCpu, FiAlertTriangle, FiCheckCircle, FiXCircle, FiInfo, FiShield, FiTrendingUp, FiTarget } from 'react-icons/fi';

function formatTitle(key) {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getSeverityClass(severity) {
  if (!severity) return '';
  const s = String(severity).toLowerCase();
  if (s === 'critical' || s === 'very high') return 'severity-critical';
  if (s === 'high') return 'severity-high';
  if (s === 'medium' || s === 'moderate') return 'severity-medium';
  return 'severity-low';
}

function getSeverityIcon(severity) {
  if (!severity) return null;
  const s = String(severity).toLowerCase();
  if (s === 'critical' || s === 'very high') return <FiXCircle />;
  if (s === 'high') return <FiAlertTriangle />;
  if (s === 'medium' || s === 'moderate') return <FiInfo />;
  return <FiCheckCircle />;
}

function getRiskBadgeClass(level) {
  if (!level) return '';
  const l = String(level).toLowerCase();
  if (l.includes('critical') || l.includes('very high') || l === 'decline') return 'critical';
  if (l.includes('high')) return 'high';
  if (l.includes('moderate') || l.includes('medium') || l === 'conditional') return 'medium';
  return 'low';
}

function getSectionIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('risk')) return <FiShield />;
  if (t.includes('recommend') || t.includes('action') || t.includes('suggestion') || t.includes('improvement')) return <FiTarget />;
  if (t.includes('factor') || t.includes('indicator') || t.includes('anomal')) return <FiAlertTriangle />;
  if (t.includes('term') || t.includes('score') || t.includes('trend')) return <FiTrendingUp />;
  return <FiInfo />;
}

function getSectionClass(title) {
  const t = title.toLowerCase();
  if (t.includes('risk') || t.includes('assessment') || t.includes('decision')) return 'risk';
  if (t.includes('factor') || t.includes('indicator') || t.includes('flag') || t.includes('anomal')) return 'indicators';
  if (t.includes('recommend') || t.includes('action') || t.includes('conclusion') || t.includes('suggestion') || t.includes('improvement')) return 'recommendation';
  if (t.includes('term') || t.includes('score') || t.includes('comparison') || t.includes('pattern')) return 'assessment';
  return 'details';
}

// Render a single object as a card with key-value pairs
function ObjectCard({ obj, index }) {
  if (!obj || typeof obj !== 'object') return <p>{String(obj)}</p>;

  // Find the "main" field (factor, action, indicator, priority, etc.)
  const mainKeys = ['factor', 'action', 'indicator', 'name', 'title', 'category'];
  const severityKeys = ['severity', 'priority', 'level', 'risk', 'urgency'];
  const descKeys = ['explanation', 'details', 'description', 'summary', 'reasoning', 'rationale'];
  const valueKeys = ['value', 'amount', 'score', 'rate', 'count'];

  const entries = Object.entries(obj);
  const mainEntry = entries.find(([k]) => mainKeys.includes(k.toLowerCase()));
  const severityEntry = entries.find(([k]) => severityKeys.includes(k.toLowerCase()));
  const descEntry = entries.find(([k]) => descKeys.includes(k.toLowerCase()));
  const valueEntry = entries.find(([k]) => valueKeys.includes(k.toLowerCase()));
  const usedKeys = new Set([mainEntry, severityEntry, descEntry, valueEntry].filter(Boolean).map(([k]) => k));
  const otherEntries = entries.filter(([k]) => !usedKeys.has(k));

  return (
    <div className="ai-object-card">
      <div className="ai-card-header">
        {severityEntry && (
          <span className={`ai-severity-badge ${getSeverityClass(severityEntry[1])}`}>
            {getSeverityIcon(severityEntry[1])} {String(severityEntry[1]).toUpperCase()}
          </span>
        )}
        <span className="ai-card-title">
          {mainEntry ? String(mainEntry[1]) : `Item ${index + 1}`}
        </span>
        {valueEntry && (
          <span className="ai-card-value">{String(valueEntry[1])}</span>
        )}
      </div>
      {descEntry && <p className="ai-card-desc">{String(descEntry[1])}</p>}
      {otherEntries.length > 0 && (
        <div className="ai-card-meta">
          {otherEntries.map(([k, v]) => (
            <span key={k} className="ai-meta-item">
              <strong>{formatTitle(k)}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Render a nested object as key-value list
function NestedObject({ obj }) {
  if (!obj || typeof obj !== 'object') return <p>{String(obj || 'N/A')}</p>;
  const entries = Object.entries(obj);
  if (entries.length === 0) return <p>N/A</p>;

  return (
    <div className="ai-nested-object">
      {entries.map(([k, v]) => (
        <div key={k} className="ai-kv-row">
          <span className="ai-kv-label">{formatTitle(k)}</span>
          <span className="ai-kv-value">
            {v === null || v === undefined ? 'N/A' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderSection(key, value) {
  const title = formatTitle(key);

  // Skip raw_response if we also have real parsed fields
  if (key === 'raw_response' || key === 'rawResponse') return null;

  // Primitive value
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') {
    return (
      <div key={key} className={`ai-section ${getSectionClass(title)}`}>
        <div className="ai-section-title">{getSectionIcon(title)} {title}</div>
        <p className="ai-section-value">{String(value)}</p>
      </div>
    );
  }

  // Array of objects
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    // Array of strings
    if (value.every(v => typeof v !== 'object')) {
      return (
        <div key={key} className={`ai-section ${getSectionClass(title)}`}>
          <div className="ai-section-title">{getSectionIcon(title)} {title}</div>
          <ul className="ai-list">{value.map((v, i) => <li key={i}>{String(v)}</li>)}</ul>
        </div>
      );
    }

    // Array of objects - render as cards
    return (
      <div key={key} className={`ai-section ${getSectionClass(title)}`}>
        <div className="ai-section-title">{getSectionIcon(title)} {title} <span className="ai-count">({value.length})</span></div>
        <div className="ai-cards-list">
          {value.map((item, i) => (
            typeof item === 'object' && item !== null
              ? <ObjectCard key={i} obj={item} index={i} />
              : <p key={i}>{String(item)}</p>
          ))}
        </div>
      </div>
    );
  }

  // Nested object
  return (
    <div key={key} className={`ai-section ${getSectionClass(title)}`}>
      <div className="ai-section-title">{getSectionIcon(title)} {title}</div>
      <NestedObject obj={value} />
    </div>
  );
}

// Parse markdown text fallback
function parseMarkdownSections(text) {
  if (!text) return [];
  const sections = [];
  const lines = text.split('\n');
  let currentSection = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headerMatch = trimmed.match(/^(?:#{1,3}\s*)?(?:\*\*)?([A-Z][A-Za-z\s&\-/]+?)(?:\*\*)?:?\s*$/);
    if (headerMatch) {
      currentSection = { title: headerMatch[1].trim(), items: [] };
      sections.push(currentSection);
      continue;
    }
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (bulletMatch || numberedMatch) {
      const content = (bulletMatch ? bulletMatch[1] : numberedMatch[1]).replace(/\*\*/g, '');
      if (!currentSection) { currentSection = { title: 'Analysis', items: [] }; sections.push(currentSection); }
      currentSection.items.push(content);
      continue;
    }
    if (!currentSection) { currentSection = { title: 'Analysis', items: [] }; sections.push(currentSection); }
    currentSection.items.push(trimmed.replace(/\*\*/g, ''));
  }
  if (sections.length === 0) sections.push({ title: 'Analysis', items: [text] });
  return sections;
}

export default function AIResultsDisplay({ data, title = 'AI Analysis Results' }) {
  if (!data) return null;

  const analysis = typeof data === 'object' && data.analysis ? data.analysis : data;

  // Extract risk level for the badge
  let riskLevel = null;
  if (typeof analysis === 'object' && analysis !== null && !Array.isArray(analysis)) {
    const rl = analysis.recommendation || analysis.risk_assessment?.overall_risk ||
      analysis.riskAssessment?.overallRisk || analysis.anomaly_level || analysis.anomalyLevel ||
      analysis.risk_level || analysis.riskLevel || analysis.risk_assessment || '';
    if (typeof rl === 'string') riskLevel = rl;
    else if (typeof rl === 'object' && rl?.overall_risk) riskLevel = rl.overall_risk;
    else if (typeof rl === 'object' && rl?.overallRisk) riskLevel = rl.overallRisk;
  }

  // Structured JSON object - render professionally
  if (typeof analysis === 'object' && analysis !== null && !Array.isArray(analysis) && !analysis.raw_response && !analysis.rawResponse) {
    const entries = Object.entries(analysis);
    return (
      <div className="ai-results">
        <div className="ai-results-header">
          <FiCpu className="ai-icon" />
          <h4>{title}</h4>
        </div>
        <div className="ai-results-body">
          {riskLevel && (
            <div className={`ai-risk-badge ${getRiskBadgeClass(riskLevel)}`}>
              {String(riskLevel).toUpperCase().replace(/_/g, ' ')}
            </div>
          )}
          {entries.map(([key, value]) => renderSection(key, value)).filter(Boolean)}
        </div>
      </div>
    );
  }

  // Fallback: raw text or raw_response - parse as markdown
  const text = analysis?.raw_response || analysis?.rawResponse ||
    (typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2));
  const markdownSections = parseMarkdownSections(text);
  const riskMatch = text.match(/risk[:\s]*(?:level[:\s]*)?(low|medium|high|critical)/i);

  return (
    <div className="ai-results">
      <div className="ai-results-header">
        <FiCpu className="ai-icon" />
        <h4>{title}</h4>
      </div>
      <div className="ai-results-body">
        {riskMatch && <div className={`ai-risk-badge ${getRiskBadgeClass(riskMatch[1])}`}>Risk: {riskMatch[1].toUpperCase()}</div>}
        {markdownSections.map((sec, i) => (
          <div key={i} className={`ai-section ${getSectionClass(sec.title)}`}>
            <div className="ai-section-title">{getSectionIcon(sec.title)} {sec.title}</div>
            {sec.items.length === 1 ? <p>{sec.items[0]}</p> : <ul className="ai-list">{sec.items.map((item, j) => <li key={j}>{item}</li>)}</ul>}
          </div>
        ))}
      </div>
    </div>
  );
}
