const express = require("express");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 8787;
const TOKEN = process.env.MATCHPLAY_TOKEN;

if (!TOKEN) {
  console.error("Missing MATCHPLAY_TOKEN. Add it to your .env file.");
  process.exit(1);
}

app.use(express.static(__dirname));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/api/*path", async (req, res) => {
  try {
    const url = "https://api.matchplay.events" + req.originalUrl;

    console.log("Proxying:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    res
      .status(response.status)
      .type(response.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send(String(err));
  }
});

app.listen(PORT, () => {
  console.log(`Match Play proxy running on http://localhost:${PORT}`);
});