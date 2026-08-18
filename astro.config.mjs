// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';
import { createDevelopmentCatalogIntegration } from './tools/dev-catalog/astro-integration.mjs';

const site = process.env.PUBLIC_SITE_URL || undefined;
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [react(), createDevelopmentCatalogIntegration({ repoRoot })]
});
