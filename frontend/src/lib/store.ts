export function levelColor(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":    return "#f85149";
    case "CRITICAL": return "#ff7b72";
    case "WARNING":  return "#e3b341";
    case "INFO":     return "#58a6ff";
    case "DEBUG":    return "#8b949e";
    default:         return "#6e7681";
  }
}

export function levelBg(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":    return "rgba(248,81,73,0.12)";
    case "CRITICAL": return "rgba(255,123,114,0.12)";
    case "WARNING":  return "rgba(227,179,65,0.12)";
    case "INFO":     return "rgba(88,166,255,0.12)";
    case "DEBUG":    return "rgba(139,148,158,0.08)";
    default:         return "rgba(110,118,129,0.08)";
  }
}
