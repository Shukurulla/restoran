const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const CategoryRouter = require("./routers/category");
const FoodRouter = require("./routers/food");
const multer = require("multer");
const path = require("path");

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/Images");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
});

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
app.use(express.static("publice"));

app.get("/", (req, res) => {
  res.json({ data: "Hello World" });
});

connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log("server has ben started");
  });
});
