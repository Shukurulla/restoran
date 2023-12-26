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

const hour = new Date().getHours();

if (hour >= 19) {
  axios.post(
    "https://restoran-service.onrender.com/edit-service/6586ada29f9b4343513a1fc3",
    {
      title: "Ofitsiyant xizmati uchun",
      persent: 15,
    }
  );
} else {
  axios.post(
    "https://restoran-service.onrender.com/edit-service/6586ada29f9b4343513a1fc3",
    {
      title: "Ofitsiyant xizmati uchun",
      persent: 10,
    }
  );
}

module.exports = router;
