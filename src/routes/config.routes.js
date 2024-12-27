// backend/src/routes/config.routes.js
router.get('/config', (req, res) => {
    res.json({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      API_URL: process.env.API_URL
    });
  });