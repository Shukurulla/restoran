const express = require("express");
const Call = require("../models/call");
const cors = require("cors");
const router = express.Router();

router.get("/call", cors(), async (req, res) => {
  const call = await Call.find();
  res.json(call);
});
router.post("/call", cors(), async (req, res) => {
  await Call.create(req.body);
  const call = await Call.find();
  res.json(call);
});
router.post("/edit-call/:id", cors(), async (req, res) => {
  await Call.findByIdAndUpdate(req.params.id, req.body);
  const call = await Call.find();
  res.json(call);
});
router.post("/delete-call/:id", cors(), async (req, res) => {
  await Call.findByIdAndRemove(req.params.id);
  const call = await Call.find();
  res.json(call);
});

module.exports = router;
