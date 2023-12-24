const express = require("express");
const Discount = require("../models/discount");
const cors = require("cors");
const router = express.Router();

router.get("/discount", cors(), async (req, res) => {
  const discount = await Discount.find();
  res.json({ data: discount });
});

router.post("/discount", cors(), async (req, res) => {
  await Discount.create(req.body);
  const discount = await Discount.find();
  res.json({ data: discount });
});
router.post("/edit-discount/:id", cors(), async (req, res) => {
  await Discount.findByIdAndUpdate(req.params.id, req.body);
  const discount = await Discount.find();
  res.json({ data: discount });
});
router.post("/delete-discount/:id", cors(), async (req, res) => {
  await Discount.findByIdAndRemove(req.params.id);
  const discount = await Discount.find();
  res.json({ data: discount });
});

module.exports = router;
