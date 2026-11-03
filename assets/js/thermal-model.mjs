/** An illustrative first-order thermal response, not an instrument or engineering design tool. */
export const thermalDefaults = Object.freeze({initial:'80', ambient:'20', timeConstant:'4', duration:'10'});
const definitions = {
  initial: {label:'Initial temperature', min:-273.15, max:1000, unit:'°C'},
  ambient: {label:'Ambient temperature', min:-273.15, max:1000, unit:'°C'},
  timeConstant: {label:'Time constant', min:0.001, max:10000, unit:'min'},
  duration: {label:'Duration', min:0.05, max:10000, unit:'min'}
};
/** @param {Record<string,string>} input */
export function thermalModel(input) {
  const values = {}, errors = {};
  for (const [key, def] of Object.entries(definitions)) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ? Number(value) : NaN;
    if (!Number.isFinite(number) || number < def.min || number > def.max) {
      errors[key] = `${def.label} must be a number from ${def.min} to ${def.max} ${def.unit}.`;
    } else values[key] = number;
  }
  if (Object.keys(errors).length) return {errors, rows:[]};
  const rows = Array.from({length:6}, (_, index) => {
    const minutes = values.duration * index / 5;
    const temperature = values.ambient + (values.initial-values.ambient)*Math.exp(-minutes/values.timeConstant);
    return {minutes, temperature};
  });
  return {errors, rows};
}
export const thermalNumber = value => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
export function thermalCsv(rows) {
  return ['Time (min),Temperature (°C)', ...rows.map(row => `${thermalNumber(row.minutes)},${thermalNumber(row.temperature)}`)].join('\r\n');
}
