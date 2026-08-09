module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/utils/scheduling.js",
    "src/controllers/taskController.js",
    "src/controllers/casualController.js",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
};
