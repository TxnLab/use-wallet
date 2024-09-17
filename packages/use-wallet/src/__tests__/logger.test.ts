import { Logger, LogLevel } from 'src/logger'

describe('Logger', () => {
  let logger: Logger
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Reset singleton instance
    Logger['instance'] = null
    logger = Logger.getInstance()

    // Set isClient to true for testing
    logger.setIsClient(true)

    // Mock console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Set log level to DEBUG
    Logger.setLevel(LogLevel.DEBUG)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return the same instance', () => {
    const logger1 = Logger.getInstance()
    const logger2 = Logger.getInstance()
    expect(logger1).toBe(logger2)
  })

  it('should log at all levels when set to DEBUG', () => {
    logger.debug('Test debug')
    logger.info('Test info')
    logger.warn('Test warn')
    logger.error('Test error')

    expect(consoleInfoSpy).toHaveBeenCalledWith('Test debug')
    expect(consoleInfoSpy).toHaveBeenCalledWith('Test info')
    expect(consoleWarnSpy).toHaveBeenCalledWith('Test warn')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Test error')
  })

  it('should respect log level changes', () => {
    Logger.setLevel(LogLevel.WARN)

    logger.debug('Test debug')
    logger.info('Test info')
    logger.warn('Test warn')
    logger.error('Test error')

    expect(consoleInfoSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledWith('Test warn')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Test error')
  })

  it('should only log errors when set to ERROR level', () => {
    Logger.setLevel(LogLevel.ERROR)

    logger.debug('Test debug')
    logger.info('Test info')
    logger.warn('Test warn')
    logger.error('Test error')

    expect(consoleInfoSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Test error')
  })

  it('should log with scope when using scoped logger', () => {
    const scopedLogger = logger.createScopedLogger('MyScope')

    scopedLogger.debug('Scoped debug')
    scopedLogger.info('Scoped info')
    scopedLogger.warn('Scoped warn')
    scopedLogger.error('Scoped error')

    expect(consoleInfoSpy).toHaveBeenCalledWith('[MyScope] Scoped debug')
    expect(consoleInfoSpy).toHaveBeenCalledWith('[MyScope] Scoped info')
    expect(consoleWarnSpy).toHaveBeenCalledWith('[MyScope] Scoped warn')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[MyScope] Scoped error')
  })
})
