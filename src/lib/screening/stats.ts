export interface ScreeningStats {
  total: number;
  included: number;
  excluded: number;
  pending: number;
  percentages: {
    included: number;
    excluded: number;
    pending: number;
  };
}

export function calculatePercentages(total: number, included: number, excluded: number, pending: number) {
  if (total === 0) {
    return { included: 0, excluded: 0, pending: 0 };
  }

  return {
    included: Math.round((included / total) * 100),
    excluded: Math.round((excluded / total) * 100),
    pending: Math.round((pending / total) * 100)
  };
}
