const express = require("express");
const cors = require("cors");
const SaveOrder = require("../models/checkOrder");
const router = express.Router();

router.get("/save-orders", cors(), async (req, res) => {
  const saveOrders = await SaveOrder.find();
  res.json({ data: saveOrders });
});
router.post("/save-orders", cors(), async (req, res) => {
  await SaveOrder.create(req.body);
  const saveOrders = await SaveOrder.find();
  res.json({ data: saveOrders });
});
router.post("/edit-save-orders/:id", cors(), async (req, res) => {
  await SaveOrder.findByIdAndUpdate(req.params.id, req.body);
  const saveOrders = await SaveOrder.find();
  res.json({ data: saveOrders });
});
router.post("/delete-save-orders/:id", cors(), async (req, res) => {
  await SaveOrder.findByIdAndRemove(req.params.id);
  const saveOrders = await SaveOrder.find();
  res.json({ data: saveOrders });
});

module.exports = router;
