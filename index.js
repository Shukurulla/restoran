const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const Order = require("./models/order");
const Foods = require("./models/foods");
const fileUpload = require("express-fileupload");
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require("./routers/category"));
app.use(require("./routers/food"));
app.use(require("./routers/dosage"));
app.use(require("./routers/table"));
app.use(require("./routers/order"));
app.use(require("./routers/saveOrders"));
app.use(require("./routers/debt"));
app.use(fileUpload());

app.use(express.static("public"));

app.post("/orders", cors(), async (req, res) => {
  console.log(req.body);
  await Order.create(req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});

app.post("/foods-create", cors(), async (req, res) => {
  const { file } = req.files;
  await file.mv(
    path.resolve(__dirname, "public/Images", file.name),
    async (err) => {
      await Foods.create({ ...req.body, image: file.name });
      const foods = await Foods.find();
      res.json({ data: foods });
    }
  );
});

app.listen(process.env.PORT, () => {
  console.log("server has ben started");
});
