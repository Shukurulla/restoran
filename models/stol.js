const mongoose = require("mongoose");

const StolSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  qrCode: {
    type: String,
  },
});

const Stol = mongoose.model("Stol", StolSchema);

module.exports = Stol;
