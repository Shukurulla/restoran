const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const FileReader = require("filereader");

router.get("/foods", cors(), async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});

router.post("/foods-create", cors(), async (req, res) => {
  let link = "";
  const reader = new FileReader();

  reader.addEventListener("load", async () => {
    link = reader.result;
  });

  reader.readAsDataURL(req.body.image);
  await Food.create({ ...req.body, image: link });
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
