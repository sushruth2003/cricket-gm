export const formatCr = (valueInLakhs: number): string => {
  if (valueInLakhs <= 0) {
    return '₹0.00 Cr'
  }
  return `₹${(valueInLakhs / 100).toFixed(2)} Cr`
}
