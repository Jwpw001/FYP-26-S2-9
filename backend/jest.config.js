module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/utils/scheduling.js",
    "src/controllers/taskController.js",
    "src/controllers/casualController.js",
    "src/utils/pushNotify.js",
    "src/controllers/pushController.js",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
};
