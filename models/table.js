const mongoose = require("mongoose");

const tableSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  surcharge: {
    type: Number,
    required: true,
  },
  fodDJ: {
    type: Boolean,
    required: true,
  },
});

const Table = mongoose.model("Table", tableSchema);

module.exports = Table;
