require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json({ limit: '15mb' }));

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

app.post('/identify', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 saknas i request-body' });
  }
  if (!GOOGLE_VISION_API_KEY) {
    return res.status(500).json({ error: 'Servern saknar GOOGLE_VISION_API_KEY (se .env.example)' });
  }

  try {
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [
                { type: 'WEB_DETECTION', maxResults: 5 },
                { type: 'LABEL_DETECTION', maxResults: 10 },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errText = await visionResponse.text();
      console.error('Vision API-fel:', visionResponse.status, errText);
      return res.status(502).json({ error: `Vision API svarade ${visionResponse.status}` });
    }

    const data = await visionResponse.json();
    const result = data.responses?.[0];

    const bestGuess = result?.webDetection?.bestGuessLabels?.[0]?.label;
    const topLabel = result?.labelAnnotations?.[0];

    if (!bestGuess && !topLabel) {
      return res.json({ label: 'Okänt djur', confidence: 0.3 });
    }

    res.json({
      label: bestGuess ?? topLabel.description,
      confidence: topLabel?.score ?? 0.5,
    });
  } catch (err) {
    console.error('Identify-fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Djurapp-backend körs på http://0.0.0.0:${PORT}`);
});
