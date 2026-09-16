export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message)
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new ApiError(429, 'RATE_LIMITED', message)
  }

  static planLimitReached(metric: string) {
    return new ApiError(402, 'PLAN_LIMIT_REACHED', `Your plan's limit for ${metric} has been reached. Upgrade to continue.`)
  }

  static usageAllowanceExceeded(message: string, details: { limit: number; used: number; requested: number; remaining: number }) {
    return new ApiError(402, 'USAGE_ALLOWANCE_EXCEEDED', message, details)
  }

  static internal(message = 'Something went wrong on our end') {
    return new ApiError(500, 'INTERNAL_ERROR', message)
  }
}
