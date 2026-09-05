export interface SeedLogger {
  info(message: string): void
  success(message: string): void
  warn(message: string): void
  error(message: string): void
}

const writeLine = (stream: NodeJS.WriteStream, line: string): void => {
  stream.write(`${line}\n`)
}

export const createSeedLogger = (scope = 'Seed'): SeedLogger => {
  const prefix = `[${scope}]`

  return {
    info: (message) => writeLine(process.stdout, `${prefix} ${message}`),
    success: (message) => writeLine(process.stdout, `${prefix} OK ${message}`),
    warn: (message) => writeLine(process.stderr, `${prefix} WARN ${message}`),
    error: (message) => writeLine(process.stderr, `${prefix} ERROR ${message}`),
  }
}
