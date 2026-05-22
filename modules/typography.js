export function getFragmentTypography(fragment) {
  const emphasis = Math.max(0, Math.min(1, fragment.weight || 0.5));
  const size = Math.round(13 + emphasis * 13);

  return {
    fontSize: size,
    letterSpacing: emphasis > 0.6 ? 0.03 : 0.01,
    opacity: 0.82 + emphasis * 0.16,
    weight: emphasis > 0.5 ? 700 : 500,
  };
}
