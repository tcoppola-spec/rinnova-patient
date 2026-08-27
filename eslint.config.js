import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist: the web build. ios: the native Xcode project, which contains a COPY
  // of the built bundle under App/App/public — linting minified output is noise.
  // .netlify: local Netlify dev cache.
  globalIgnores(['dist', 'ios', '.netlify']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Compile-time constant injected by vite.config.js (the build id the
        // update check compares against /version.json).
        __APP_VERSION__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Netlify Functions run on Node, not in the browser — they use `process`,
    // Buffer, etc. Give just that directory the Node globals.
    files: ['netlify/functions/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
