const mongoose = require("mongoose");

const Service = mongoose.model("Service", {
  title: {
    type: String,
    required: true,
  },
  persent: {
    type: Number,
    required: true,
  },
});

module.exports = Service;
