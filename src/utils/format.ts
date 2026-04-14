export const formatK = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
  }
  if (num >= 1000) {
    // Show decimal for low thousands (e.g., 1.3K) but round for high thousands (e.g., 464K)
    if (num < 10000) {
      return (num / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
    }
    return Math.round(num / 1000).toLocaleString() + 'K';
  }
  return Math.round(num).toLocaleString();
};
