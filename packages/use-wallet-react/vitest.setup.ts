/// <reference types="vitest" />

import '@testing-library/jest-dom/vitest'

// Suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})
