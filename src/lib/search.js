function flattenField(val, out) {
  if (val === null || val === undefined) return
  if (Array.isArray(val)) {
    for (const item of val) flattenField(item, out)
    return
  }
  if (typeof val === 'object') {
    for (const v of Object.values(val)) flattenField(v, out)
    return
  }
  out.push(String(val))
}

export function normalizeSearchTokens(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^#+/, ''))
    .filter(Boolean)
}

export function matchesSearch(query, ...fields) {
  const tokens = normalizeSearchTokens(query)
  if (tokens.length === 0) return true

  const parts = []
  for (const f of fields) flattenField(f, parts)
  const haystack = parts.join(' ').toLowerCase().replace(/\s+/g, ' ')

  return tokens.every((token) => haystack.includes(token))
}
