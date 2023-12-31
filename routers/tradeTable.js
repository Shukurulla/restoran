const express = require("express");
const TradeTable = require("../models/tradeTable");
const cors = require("cors");
const router = express.Router();

router.get("/trade-table", cors(), async (req, res) => {
  const tradeTable = await TradeTable.find();
  res.json(tradeTable);
});
router.post("/trade-table", cors(), async (req, res) => {
  await TradeTable.create(req.body);
  const tradeTable = await TradeTable.find();
  res.json(tradeTable);
});
router.post("/edit-trade-table/:id", cors(), async (req, res) => {
  await TradeTable.findByIdAndUpdate(req.params.id, req.body);
  const tradeTable = await TradeTable.find();
  res.json(tradeTable);
});
router.post("/delete-trade-table/:id", cors(), async (req, res) => {
  await TradeTable.findByIdAndRemove(req.params.id);
  const tradeTable = await TradeTable.find();
  res.json(tradeTable);
});

module.exports = router;
