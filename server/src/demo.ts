/**
 * Demo-only state. "Chaos mode" makes the Insights variant of /api/reports/usage
 * return a malformed payload, simulating a bad upstream deploy so the new
 * dashboard fails on real data handling (not a planted throw).
 *
 * It is reset automatically when the flag is turned off - i.e. when the
 * release is rolled back, the bad data goes away with it.
 */
export const demoState = {
  chaos: false,
};
