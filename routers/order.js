const express = require("express");
const Order = require("../models/order");
const router = express.Router();
const cors = require("cors");

router.get("/orders", cors(), async (req, res) => {
  const orders = await Order.find();
  res.json({ data: orders });
});
router.post("/orders", cors(), async (req, res) => {
  await Order.create({ ...req.body, agent: { ip: req.ipInfo } });
  const orders = await Order.find();
  res.json({ data: orders });
});
router.post("/edit-order/:id", cors(), async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});
router.post("/delete-order/:id", cors(), async (req, res) => {
  await Order.findByIdAndRemove(req.params.id);
  const orders = await Order.find();
  res.json({ data: orders });
});

module.exports = router;
