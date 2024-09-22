export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

export class Logger {
  private static instance: Logger | null = null
  private level: LogLevel
  private isClient: boolean

  private constructor() {
    this.level = LogLevel.WARN
    this.isClient = typeof window !== 'undefined'
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  public static setLevel(level: LogLevel): void {
    Logger.getInstance().level = level
  }

  private log(level: LogLevel, scope: string | undefined, message: string, ...args: any[]): void {
    if (level >= this.level && this.isClient) {
      const formattedMessage = scope ? `[${scope}] ${message}` : message
      switch (level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          console.info(formattedMessage, ...args)
          break
        case LogLevel.WARN:
          console.warn(formattedMessage, ...args)
          break
        case LogLevel.ERROR:
          console.error(formattedMessage, ...args)
          break
      }
    }
  }

  public createScopedLogger(scope: string) {
    return {
      debug: (message: string, ...args: any[]) => this.log(LogLevel.DEBUG, scope, message, ...args),
      info: (message: string, ...args: any[]) => this.log(LogLevel.INFO, scope, message, ...args),
      warn: (message: string, ...args: any[]) => this.log(LogLevel.WARN, scope, message, ...args),
      error: (message: string, ...args: any[]) => this.log(LogLevel.ERROR, scope, message, ...args)
    }
  }

  public debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, undefined, message, ...args)
  }

  public info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, undefined, message, ...args)
  }

  public warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, undefined, message, ...args)
  }

  public error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, undefined, message, ...args)
  }

  // For testing purposes
  public setIsClient(isClient: boolean): void {
    this.isClient = isClient
  }
}

export const logger = Logger.getInstance()
