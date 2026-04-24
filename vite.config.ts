import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'workflow-api',
        configureServer(server) {
          server.middlewares.use('/api/workflows', (req, res) => {
            const dirPath = path.join(process.cwd(), 'WorkFlowSample');
            if (!fs.existsSync(dirPath)) {
              res.end(JSON.stringify([]));
              return;
            }

            try {
              const files = fs.readdirSync(dirPath);
              const workflows = files
                .filter((file) => file.endsWith('.json'))
                .map((file) => {
                  const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
                  return {
                    filename: file,
                    content: JSON.parse(content),
                  };
                });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(workflows));
            } catch (err) {
              console.error('Error reading WorkFlowSample:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to read workflows' }));
            }
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
