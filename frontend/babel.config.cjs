// Test-only — Vite's own build never touches Babel. This exists solely so Jest (CommonJS-based)
// can transform this package's ES modules ("type": "module" in package.json); it has no effect
// on `npm run dev`/`build`, which stay on Vite/esbuild exactly as before.
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  // Jest runs under CommonJS, which has no `import.meta` — this rewrites `import.meta.env.X`
  // (Vite's env-var syntax, used by src/lib/api.js) to `process.env.X` for tests only.
  plugins: ["babel-plugin-transform-vite-meta-env"],
};
