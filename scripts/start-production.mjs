#!/usr/bin/env node

process.env.NODE_ENV = 'production';
await import('../dist/server/server.cjs');
