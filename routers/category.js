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

router.post("/edit-category/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Category.findByIdAndUpdate(id, req.body);
  const categories = await Category.find();
  res.json({ data: categories });
});
router.post("/delete-category/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Category.findByIdAndRemove(id);
  const foods = await Category.find();
  res.json({ data: foods });
});

module.exports = router;
