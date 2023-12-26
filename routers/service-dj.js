const express = require("express");
const ServiceDJ = require("../models/service-dj");
const cors = require("cors");
const router = express.Router();

router.get("/service-dj", cors(), async (req, res) => {
  const service = await ServiceDJ.find();
  res.json({ data: service });
});
router.post("/service-dj", cors(), async (req, res) => {
  await ServiceDJ.create(req.body);
  const service = await ServiceDJ.find();
  res.json({ data: service });
});

router.post("/edit-service-dj/:id", cors(), async (req, res) => {
  await ServiceDJ.findByIdAndUpdate(req.params.id, req.body);
  const service = await ServiceDJ.find();
  res.json({ data: service });
});
router.post("/delete-service-dj/:id", cors(), async (req, res) => {
  await ServiceDJ.findByIdAndRemove(req.params.id);
  const service = await ServiceDJ.find();
  res.json({ data: service });
});

module.exports = router;
