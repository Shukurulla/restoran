const express = require("express");
const Karaoke = require("../models/karaoke");
const cors = require("cors");
const router = express.Router();

router.get("/karaoke", cors(), async (req, res) => {
  const karaoke = await Karaoke.find();
  res.json({ data: karaoke });
});

router.post("/karaoke", cors(), async (req, res) => {
  await Karaoke.create(req.body);
  const karaoke = await Karaoke.find();
  res.json({ data: karaoke });
});
router.post("/edit-karaoke/:id", cors(), async (req, res) => {
  await Karaoke.findByIdAndUpdate(req.params.id, req.body);
  const karaoke = await Karaoke.find();
  res.json({ data: karaoke });
});
router.post("/delete-karaoke/:id", cors(), async (req, res) => {
  await Karaoke.findByIdAndRemove(req.params.id);
  const karaoke = await Karaoke.find();
  res.json({ data: karaoke });
});

module.exports = router;
