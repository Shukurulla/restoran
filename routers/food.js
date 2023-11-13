const express = require("express");
const Food = require("../models/foods");
const router = express.Router();

router.get("/foods", async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});

router.post("/foods", async (req, res) => {
  await Food.create(req.body);
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
