const mongoose = require("mongoose");

const tableSchema = mongoose.Schema({
  
  title: {
    type: String,
    required: true,
  },
});

const Table = mongoose.model("Table", tableSchema);

module.exports = Table;
