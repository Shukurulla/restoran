const express = require("express");
const ServiceDJ = require("../models/service-dj");
const cors = require("cors");
const router = express.Router();
const axios = require("axios");

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

const hour = new Date();

if (hour > 18 && hour < 6) {
  axios.post(
    "https://restoran-service.onrender.com/edit-service-dj/658b16c52ba2a9c35dc80c0a",
    {
      serviceDosage: 5000,
    }
  );
} else {
  axios.post(
    "https://restoran-service.onrender.com/edit-service-dj/658b16c52ba2a9c35dc80c0a",
    {
      serviceDosage: 0,
    }
  );
}

module.exports = router;
