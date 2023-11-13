const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const CategoryRouter = require("./routers/category");
const FoodRouter = require("./routers/food");

require("dotenv").config();
// enable cors
app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

mongoose.connect(process.env.MONGO_URI).then((res) => {
  res && console.log("database connected");
});

mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(err);
    process.exit(1);
  }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(CategoryRouter);
app.use(FoodRouter);

app.get("/", (req, res) => {
  res.json({ data: "Hello World" });
});

connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log("server has ben started");
  });
});
