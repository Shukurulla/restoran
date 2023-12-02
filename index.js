const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const expressip = require("express-ip");
var useragent = require("express-useragent");
const Order = require("./models/order");

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

app.use(expressip().getIpInfoMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require("./routers/category"));
app.use(require("./routers/food"));
app.use(require("./routers/dosage"));
app.use(require("./routers/table"));
app.use(require("./routers/order"));
app.use(require("./routers/saveOrders"));
app.use(require("./routers/debt"));
app.use(useragent.express());
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {});

app.post("/orders", cors(), async (req, res) => {
  console.log(req.body);
  await Order.create({
    ...req.body,
    agent: { ipAddress: req.ipInfo },
  });
  const orders = await Order.find();
  res.json({ data: orders });
});
app.listen(process.env.PORT, () => {
  console.log("server has ben started");
});
