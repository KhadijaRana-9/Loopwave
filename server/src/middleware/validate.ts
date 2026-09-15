import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'

interface Schemas {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}

// Parses (not just checks) each part of the request through its schema and
// replaces req.body/query/params with the parsed result, so controllers get
// typed, coerced, defaulted values instead of raw strings.
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body)
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params
      next()
    } catch (err) {
      next(err)
    }
  }
}
