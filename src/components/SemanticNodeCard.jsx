export function SemanticNodeCard({ title, text, meta, nodeId, className = "", onClick, children }) {
  const clickable = Boolean(nodeId && onClick);

  return (
    <article
      className={`zone-card ${className}`.trim()}
      data-node-id={nodeId || undefined}
      onClick={clickable ? () => onClick(nodeId) : undefined}
    >
      {title ? <strong>{title}</strong> : null}
      {text ? <span>{text}</span> : null}
      {meta ? <small>{meta}</small> : null}
      {children}
    </article>
  );
}
