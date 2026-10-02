export default function StatCard({ icon, label, value, helper, accent = "neutral" }) {
  return (
    <article className={`stat-card accent-${accent}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}
