export function AppLayout({ left, center, right }) {
  return <div className="app-shell">{left}{center}{right}</div>;
}
