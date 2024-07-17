import mongoose from 'mongoose';
import { itemsSchema } from './itemSchema.js';

const { Schema } = mongoose;

//Create List Schema
const listSchema = new Schema({
  name: String,
  items: [itemsSchema],
});

// Create List model
const List = mongoose.model('List', listSchema);

export default List;
