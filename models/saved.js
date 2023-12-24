const mongoose = require("mongoose");

const Saved = mongoose.model("Saved", {
  order: {
    type: Object,
    required: true,
  },
  clientName: String,
  clientPhone: String,
  assurance: String,
  status: {
    type: String,
    required: true,
  },
  tableId: String,
});

module.exports = Saved;
