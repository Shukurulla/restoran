const express = require("express");
const Saved = require("../models/saved");
const cors = require("cors");
const router = express.Router();

router.get("/saved", cors(), async (req, res) => {
  const saved = await Saved.find();
  res.json({ data: saved });
});
router.post("/saved", cors(), async (req, res) => {
  await Saved.create(req.body);
  const saved = await Saved.find();
  res.json({ data: saved });
});
router.post("/edit-saved/:id", cors(), async (req, res) => {
  await Saved.findByIdAndUpdate(req.params.id, req.body);
  const saved = await Saved.find();
  res.json({ data: saved });
});
router.post("/delete-saved/:id", cors(), async (req, res) => {
  await Saved.findByIdAndRemove(req.params.id);
  const saved = await Saved.find();
  res.json({ data: saved });
});

module.exports = router;
