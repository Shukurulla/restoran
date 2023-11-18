const express = require("express");
const Dosage = require("../models/dosage");
const router = express.Router();
const cors = require("cors");

router.get("/dosages", cors(), async (req, res) => {
  const dosages = await Dosage.find();
  res.json({ data: dosages });
});

router.post("/dosage", cors(), async (req, res) => {
  await Dosage.create(req.body);
  const dosage = await Dosage.find();
  res.json({ data: dosage });
});

router.post("/edit-dosage/:id", cors(), async (req, res) => {
  await Dosage.findByIdAndUpdate(req.params.id, req.body);
  const dosage = await Dosage.find();
  res.json({ data: dosage });
});
router.post("/delete-dosage/:id", cors(), async (req, res) => {
  await Dosage.findByIdAndDelete(req.params.id);
  const dosage = await Dosage.find();
  res.json({ data: dosage });
});

module.exports = router;
