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
app.use(fileUpload());

app.use(express.static("public"));

app.post("/orders", cors(), async (req, res) => {
  await Order.create(req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});
const hour = new Date().getHours();
console.log(hour);

if (hour > 11 && hour <= 15) {
  axios.post(
    "https://restoran-service.onrender.com/edit-discount/6587ce2b73cf78a2f2018f77",
    {
      title: "Tushlik uchun chegirma",
      discount: 10,
    }
  );
} else {
  axios.post(
    "https://restoran-service.onrender.com/edit-discount/6587ce2b73cf78a2f2018f77",
    {
      title: "Tushlik uchun chegirma",
      discount: 0,
    }
  );
}

app.listen(process.env.PORT, () => {
  console.log("server has ben started");
});
