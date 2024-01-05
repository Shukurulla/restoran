const express = require("express");
const Service = require("../models/service");
const cors = require("cors");
const router = express.Router();
const axios = require("axios");

router.get("/services", cors(), async (req, res) => {
  const services = await Service.find();
  res.json({ data: services });
});
router.post("/post-service", cors(), async (req, res) => {
  await Service.create(req.body);
  const services = await Service.find();
  res.json({ data: services });
});
router.post("/edit-service/:id", cors(), async (req, res) => {
  await Service.findByIdAndUpdate(req.params.id, req.body);
  const services = await Service.find();
  res.json({ data: services });
});
router.post("/delete-service/:id", cors(), async (req, res) => {
  await Service.findByIdAndRemove(req.params.id);
  const services = await Service.find();
  res.json({ data: services });
});

module.exports = router;
