const mongoose = require("mongoose");

const Stol = mongoose.model("Stol", {
  title: {
    type: String,
    required: true,
  },
  qrCode: {
    type: String,
  },
});

module.exports = Stol;
