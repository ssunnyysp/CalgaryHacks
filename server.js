const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const BRIDGE_PORT = 8787;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;

// Python fallacy detector process - will be spawned on demand
let pythonProcess = null;

/**
 * Call Python fallacy detector
 */
async function detectFallacy(text) {
  return new Promise((resolve, reject) => {
    // Spawn Python process to detect fallacy
    const python = spawn('python3', [
      path.join(__dirname, 'Logic', 'fallacy_detector_api.py'),
      text
    ]);

    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python error: ${error}`));
        return;
      }
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${output}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * POST /analyze - Analyze text for fallacies
 */
app.post('/analyze', async (req, res) => {
  try {
    const { text, id, pageKey, color } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Detect fallacy
    const analysis = await detectFallacy(text);

    // Log to CSV via bridge
    try {
      await axios.post(`${BRIDGE_URL}/highlight`, {
        id,
        text,
        pageKey,
        color,
        url: req.headers['x-page-url'],
        fallacy: analysis.fallacy,
        confidence: analysis.confidence,
        ts: Date.now()
      });
    } catch (bridgeError) {
      console.warn('Bridge logging failed:', bridgeError.message);
      // Don't fail the response if bridge fails
    }

    res.json({
      text,
      id,
      analysis
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /batch-analyze - Analyze multiple texts
 */
app.post('/batch-analyze', async (req, res) => {
  try {
    const { highlights } = req.body; // Array of {text, id, color, pageKey}

    if (!Array.isArray(highlights)) {
      return res.status(400).json({ error: 'highlights must be an array' });
    }

    const results = await Promise.all(
      highlights.map(async (h) => {
        try {
          const analysis = await detectFallacy(h.text);
          return {
            ...h,
            analysis,
            error: null
          };
        } catch (error) {
          return {
            ...h,
            analysis: null,
            error: error.message
          };
        }
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

/**
 * GET /bridge-health - Check if bridge is running
 */
app.get('/bridge-health', async (req, res) => {
  try {
    const response = await axios.get(`${BRIDGE_URL}/health`);
    res.json({ bridge: 'ok' });
  } catch (error) {
    res.status(503).json({ bridge: 'down', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎯 Luminate Server running on http://localhost:${PORT}`);
  console.log(`📊 Bridge connected to http://localhost:${BRIDGE_PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /analyze - Analyze single text for fallacies`);
  console.log(`  POST /batch-analyze - Analyze multiple texts`);
  console.log(`  GET /health - Server health check`);
  console.log(`  GET /bridge-health - Bridge status\n`);
});
