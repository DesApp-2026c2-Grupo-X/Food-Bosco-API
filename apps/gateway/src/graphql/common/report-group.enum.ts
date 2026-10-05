import { registerEnumType } from '@nestjs/graphql'

export enum ReportGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

registerEnumType(ReportGroupBy, { name: 'ReportGroupBy' })

const BY_STRING: Record<string, ReportGroupBy> = {
  day: ReportGroupBy.DAY,
  week: ReportGroupBy.WEEK,
  month: ReportGroupBy.MONTH,
}

export const reportGroupByFromRest = (value: string): ReportGroupBy => {
  const groupBy = BY_STRING[value.toLowerCase()]
  if (!groupBy) {
    throw new Error(`Unknown report group by: ${value}`)
  }
  return groupBy
}

export const reportGroupByToRest = (groupBy: ReportGroupBy): string => groupBy.toLowerCase()
