const express = require("express");
const Order = require("../models/order");
const router = express.Router();
const cors = require("cors");

router.get("/orders", cors(), async (req, res) => {
  const orders = await Order.find();
  res.json({ data: orders });
});
router.post("/orders", cors(), async (req, res) => {
  await Order.create(req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});

module.exports = router;
