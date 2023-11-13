const express = require("express");
const Category = require("../models/category");
const router = express.Router();

router.get("/categories", async (req, res) => {
  const categories = await Category.find();
  res.json({ data: categories });
});

router.post("/categories", async (req, res) => {
  await Category.create(req.body);
  const categories = await Category.find();
  res.json({ data: categories });
});

module.exports = router;
