import { SemanticNodeCard } from "./SemanticNodeCard.jsx";

export function SemanticInspector({ title, type, summary, categories = [], links = [], relations = [] }) {
  return (
    <article className="zone-card theory-details">
      <strong>{title}</strong>
      <span>{type}</span>
      <small>{summary || "No summary available yet."}</small>
      {categories.length ? <small>Categories: {categories.slice(0, 4).join(" · ")}</small> : null}
      {links.length ? <small>Internal links: {links.slice(0, 4).join(" · ")}</small> : null}
      {relations.length ? (
        <div className="theory-details">
          {relations.map((relation) => (
            <SemanticNodeCard
              key={`${relation.label}-${relation.explanation}`}
              className="theory-details"
              title={relation.label}
              text={`${relation.explanation} · confidence ${relation.confidence}%`}
              meta={relation.evidence?.length ? `evidence ${relation.evidence.join(" · ")}` : undefined}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
