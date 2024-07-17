import mongoose from 'mongoose';

const { Schema } = mongoose;

//Create items Schema
const itemsSchema = new Schema({
  name: String,
});

//Create Item Model
const Item = mongoose.model('Item', itemsSchema);

export { itemsSchema, Item };
