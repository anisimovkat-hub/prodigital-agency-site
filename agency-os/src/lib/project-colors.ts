export type ProjectBadgeColors = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

export function projectBadgeColors(projectId: string): ProjectBadgeColors {
  const hue = projectHue(projectId);

  return {
    backgroundColor: `hsl(${hue} 75% 93%)`,
    borderColor: `hsl(${hue} 58% 80%)`,
    color: `hsl(${hue} 58% 30%)`,
  };
}

export function projectHue(projectId: string): number {
  let hash = 2166136261;

  for (let index = 0; index < projectId.length; index += 1) {
    hash ^= projectId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash) % 360;
}
