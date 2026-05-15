import "@testing-library/jest-dom"

// Suppress effector noisy logs during tests
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})
