// Tiny safe-by-default HTML templating. Interpolated values are escaped
// unless they were produced by html`` or raw().
const RAW = Symbol('raw');

export function raw(s) {
  return { [RAW]: String(s) };
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function val(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(val).join('');
  if (typeof v === 'object' && v[RAW] !== undefined) return v[RAW];
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += val(v) + strings[i + 1]; });
  return raw(out);
}

export function toString(t) {
  return val(t);
}
