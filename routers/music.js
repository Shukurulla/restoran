const express = require("express");
const musicModel = require("../models/music");
const cors = require("cors");
const router = express.Router();

router.get("/musics", cors(), async (req, res) => {
  const musics = await musicModel.find();
  res.json({ data: musics });
});
router.post("/musics", cors(), async (req, res) => {
  await musicModel.create(req.body);
  const musics = await musicModel.find();
  res.json({ data: musics });
});

router.post("/musics-edit/:id", cors(), async (req, res) => {
  await musicModel.findByIdAndUpdate(req.params.id, req.body);
  const musics = await musicModel.find();
  res.json({ data: musics });
});
router.post("/musics-remove/:id", cors(), async (req, res) => {
  await musicModel.findByIdAndRemove(req.params.id);
  const musics = await musicModel.find();
  res.json({ data: musics });
});

module.exports = router;
