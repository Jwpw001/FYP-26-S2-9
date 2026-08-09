module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/utils/scheduling.js",
    "src/controllers/taskController.js",
    "src/controllers/casualController.js",
    "src/utils/pushNotify.js",
    "src/controllers/pushController.js",
    "src/utils/hoursMetrics.js",
    "src/controllers/shiftGenerationController.js",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
};
