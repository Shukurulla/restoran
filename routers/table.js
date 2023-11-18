const express = require("express");
const Table = require("../models/table");
const router = express.Router();
const cors = require("cors");

router.get("/tables", cors(), async (req, res) => {
  const tables = await Table.find();
  res.json({ data: tables });
});
router.post("/tables", cors(), async (req, res) => {
  await Table.create(req.body);
  const tables = await Table.find();
  res.json({ data: tables });
});
router.post("/edit-tables/:id", cors(), async (req, res) => {
  await Table.findByIdAndUpdate(req.params.id, req.body);
  const tables = await Table.find();
  res.json({ data: tables });
});
router.post("/delete-tables/:id", cors(), async (req, res) => {
  await Table.findByIdAndRemove(req.params.id);
  const tables = await Table.find();
  res.json({ data: tables });
});

module.exports = router;
