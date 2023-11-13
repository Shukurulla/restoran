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
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.options("/foods-create", cors());
app.options("/categories", cors());

mongoose.set("strictQuery", false);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"));

console.log(process.version);

app.listen(process.env.PORT, () =>
  console.log(`Server has ben started on port ${process.env.PORT}`)
);
