export function dqveUpdate(oldVal, newVal) {
  oldVal = Number(oldVal) || 0;
  newVal = Number(newVal) || 0;
  if (oldVal === 0) return newVal;
  const diff = newVal - oldVal;
  return oldVal + diff * 0.25; 
}
