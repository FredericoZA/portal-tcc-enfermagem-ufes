#!/usr/bin/env node

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
await rm(path.join(projectRoot, 'dist'), { recursive: true, force: true });
await rm(path.join(projectRoot, 'server.js'), { force: true });
