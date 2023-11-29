const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const expressip = require("express-ip");
var useragent = require("express-useragent");

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
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.json({
    ip: req.ipInfo,
    data: "Hello World",
    agent: req.useragent.source,
  });
});

app.listen(process.env.PORT, () => {
  console.log("server has ben started");
});
