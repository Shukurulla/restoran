const express = require("express");
const Category = require("../models/category");
const router = express.Router();
const cors = require("cors");

router.get("/categories", cors(), async (req, res) => {
  const categories = await Category.find();
  res.json({ data: categories });
});

router.post("/categories", cors(), async (req, res) => {
  await Category.create(req.body);
  const categories = await Category.find();
  res.json({ data: categories });
});

module.exports = router;
