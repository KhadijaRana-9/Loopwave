import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Express doesn't forward rejected promises to error middleware on its own;
// every async controller gets wrapped in this instead of repeating try/catch.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
