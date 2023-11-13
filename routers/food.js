const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");

router.get("/foods", cors(), async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});

router.post("/foods-create", cors(), async (req, res) => {
  await Food.create(req.body);
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
