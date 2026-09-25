// Query-string parameters whose values are credentials. Meta's webhook
// verification handshake is a GET carrying hub.verify_token in the URL, so the
// request logger — which records req.url — would otherwise write that secret
// into the production logs on every handshake.
const SENSITIVE_QUERY_PARAM = /token|secret|code|password|signature|key/i

export function redactUrlForLog(url: string | undefined): string | undefined {
  if (!url) return url
  const queryStart = url.indexOf('?')
  if (queryStart === -1) return url
  const path = url.slice(0, queryStart)
  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=')
      if (eq === -1) return pair
      const name = pair.slice(0, eq)
      return SENSITIVE_QUERY_PARAM.test(decodeURIComponentSafe(name)) ? `${name}=[REDACTED]` : pair
    })
    .join('&')
  return `${path}?${query}`
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
