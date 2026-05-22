function wrapText(context, text, maxWidth) {
  const words = text.split(/\s+/u);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) {
    lines.push(line);
  }

  return lines;
}

export function createTypographySystem() {
  return {
    getStyle(fragment) {
      const fontSize = Math.max(16, Math.min(28, 14 + fragment.emphasis * 7));
      return {
        fontSize,
        lineHeight: fontSize * 1.18,
        maxWidth: Math.min(320, 170 + fragment.text.length * 0.55),
        fontFamily: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
        color: "rgba(21, 21, 21, 0.92)",
      };
    },

    measure(context, fragment) {
      const style = this.getStyle(fragment);
      context.font = `${style.fontSize}px ${style.fontFamily}`;
      const lines = wrapText(context, fragment.text, style.maxWidth);
      const width = Math.max(...lines.map((line) => context.measureText(line).width), 0);
      const height = lines.length * style.lineHeight;

      return {
        ...style,
        lines,
        width,
        height,
      };
    },
  };
}
