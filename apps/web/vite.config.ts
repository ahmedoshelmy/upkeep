import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Dev proxy mirrors nginx.conf: GraphQL over HTTP and graphql-ws both go to the API.
const api = process.env.API_URL ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/graphql': { target: api, ws: true },
    },
  },
  test: { environment: 'node' },
})
