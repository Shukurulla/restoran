const express = require("express");
const Dedt = require("../models/debt");
const router = express.Router();
const cors = require("cors");

router.get("/debt", cors(), async (req, res) => {
  const debt = await Dedt.find();
  res.json({ data: debt });
});
router.post("/debt", cors(), async (req, res) => {
  await Dedt.create(req.body);
  const debt = await Dedt.find();
  res.json({ data: debt });
});
router.post("/edit-debt/:id", cors(), async (req, res) => {
  await Dedt.findByIdAndUpdate(req.params.id, req.body);
  const debt = await Dedt.find();
  res.json({ data: debt });
});
router.post("/delete-debt/:id", cors(), async (req, res) => {
  await Dedt.findByIdAndRemove(req.params.id);
});

module.exports = router;
