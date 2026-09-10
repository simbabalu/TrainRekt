export function selectNextScenarioIndex(currentIndex: number, scenarioCount: number): number {
  if (scenarioCount <= 1) return 0;
  return (currentIndex + 1) % scenarioCount;
}