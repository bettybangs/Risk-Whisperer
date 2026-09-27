// Local development only: lets `npm start` serve /api/assess, /api/judge, and
// /api/plain by running the same handlers Vercel runs in production. The
// React dev server loads this file automatically; it is never bundled into the
// browser code. ANTHROPIC_API_KEY comes from .env, which the dev server loads.
const express = require('express');
const path = require('path');
const { pathToFileURL } = require('url');

const ENDPOINTS = ['assess', 'judge', 'plain'];

module.exports = function (app) {
  app.post('/api/:name', express.json({ limit: '1mb' }), async (req, res, next) => {
    if (ENDPOINTS.indexOf(req.params.name) === -1) return next();
    try {
      const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', req.params.name + '.js')).href);
      await mod.default(req, res);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: { message: 'Local API failed to load: ' + e.message } });
    }
  });
};
