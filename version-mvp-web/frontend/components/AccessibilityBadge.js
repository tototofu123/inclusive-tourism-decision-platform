// Displays accessibility score as a coloured badge
export default function AccessibilityBadge({ score }) {
  if (score === undefined || score === null) return null;

  let className, label;
  if (score >= 80) {
    className = 'badge-high';
    label = `♿ ${score}/100 — Excellent`;
  } else if (score >= 60) {
    className = 'badge-mid';
    label = `⚠️ ${score}/100 — Moderate`;
  } else {
    className = 'badge-low';
    label = `❌ ${score}/100 — Limited`;
  }

  return <span className={className}>{label}</span>;
}
