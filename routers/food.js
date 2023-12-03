const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const multer = require("multer");
const path = require("path");

router.get("/foods", cors(), async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});
router.post("/foods-create", cors(), async (req, res) => {
  await Food.create(req.body);
  const food = await Food.find();
  res.json({ data: food });
});

router.post("/edit-food/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Food.findByIdAndUpdate(
    id,
    req.body.isEdit == true
      ? { ...req.body, image: req.file.filename }
      : req.body
  );
  const data = await Food.find();
  res.json({ data: data });
  console.log(req.files);
});
router.post("/delete-food/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Food.findByIdAndRemove(id);
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
