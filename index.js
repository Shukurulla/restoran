const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const Order = require("./models/order");
const fileUpload = require("express-fileupload");
const axios = require("axios");

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
app.use(require("./routers/service"));
app.use(require("./routers/discount"));
app.use(require("./routers/saved"));
app.use(require("./routers/service-dj"));
app.use(require("./routers/music"));
app.use(require("./routers/karaoke"));
app.use(require("./routers/tradeTable"));
app.use(fileUpload());

app.use(express.static("public"));

app.post("/orders", cors(), async (req, res) => {
  await Order.create(req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});

app.listen(process.env.PORT, () => {
  console.log("server has ben started");
});
