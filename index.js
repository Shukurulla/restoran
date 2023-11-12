const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const FoodRouter = require("./routers/food");
require("dotenv").config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(FoodRouter);
app.use(require("./routers/category"));
app.use(cors());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"));

console.log(process.version);

app.listen(process.env.PORT, () =>
  console.log(`Server has ben started on port ${process.env.PORT}`)
);
