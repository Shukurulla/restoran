const mongoose = require("mongoose");

const debtSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  gage: {
    type: String,
    required: true,
  },
  paymentTerm: {
    type: String,
    required: true,
  },
});

const Dedt = mongoose.model("debd", debtSchema);
module.exports = Dedt;
