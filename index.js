import express from 'express';
import bodyParser from 'body-parser';
import 'dotenv/config';
import _ from 'lodash';
import connectDB from './config/db.js';
import { Item } from './models/itemSchema.js';
import List from './models/listSchema.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Creating default items
const createDefaultItems = async () => {
  const item1 = new Item({ name: 'Welcome to your todolist!' });
  const item2 = new Item({ name: 'Hit the + to add a new item' });
  const item3 = new Item({ name: '<-- Hit this to delete an item' });
  const defaultItems = [item1, item2, item3];

  const existingItems = await Item.find();
  if (existingItems.length === 0) {
    await Item.insertMany(defaultItems);
    console.log('Default items added to database!');
  }

  return defaultItems;
};

// get current local date
const getLocalDate = (
  locale = 'en-US',
  options = { weekday: 'long', month: 'long', day: 'numeric' }
) => {
  return new Date().toLocaleDateString(locale, options);
};

/**
 * Handle GET request to render the home page with items from the current date list.
 * If no items are found, create default items and redirect to the home page.
 * @returns {render} Renders 'list' view with current date title and list of found items.
 * @throws {Error} Throws an error if there's an issue fetching items or rendering the view.
 */
app.get('/', async (req, res) => {
  try {
    const foundItems = await Item.find({});

    if (foundItems.length === 0) {
      await createDefaultItems();
      return res.redirect('/');
    }

    res.render('list', {
      currentTitle: getLocalDate(),
      newListItems: foundItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Handle GET request for custom list creation or retrieval.
 * @param {string} req.params.customNewList - The name of the custom list to create or retrieve.
 * @returns {render} Renders 'list' view with currentTitle and newListItems.
 * @throws {Error} Throws error if database operation fails or invalid input.
 */
app.get('/:customNewList', async (req, res) => {
  try {
    const customNewList = _.capitalize(req.params.customNewList);
    const defaultItems = await createDefaultItems();

    const foundList = await List.findOneAndUpdate(
      {
        name: customNewList,
      },
      { $setOnInsert: { name: customNewList, items: defaultItems } },
      { new: true, upsert: true }
    );

    if (!foundList) {
      console.log('Title name not found, creating a new list');
    }

    res.render('list', {
      currentTitle: foundList.name,
      newListItems: foundList.items,
    });
  } catch (error) {
    console.error('Error in GET /:customNewList:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Handle POST request to add an item to a list or create a new list if necessary.
 * @param {string} req.body.newItem - The name of the new item to add.
 * @param {string} req.body.list - The name of the list to which the item should be added.
 * @returns {redirect} Redirects to the home page or the specific list page after adding the item.
 * @throws {Error} Throws an error if the item cannot be added to the list or if there's a server error.
 */
app.post('/', async (req, res) => {
  const { newItem: itemName, list: listName } = req.body;

  // Input validation
  if (
    !itemName ||
    typeof itemName !== 'string' ||
    itemName.trim().length === 0
  ) {
    return res.status(400).send('Item name must be a non-empty string');
  }
  if (
    !listName ||
    typeof listName !== 'string' ||
    listName.trim().length === 0
  ) {
    return res.status(400).send('List name must be a non-empty string');
  }

  const item = new Item({
    name: itemName,
  });

  try {
    if (listName === getLocalDate()) {
      await item.save();
      res.redirect('/');
    } else {
      const foundList = await List.findOne({ name: listName });
      if (!foundList) {
        return res.status(400).send('List not found!');
      }
      foundList.items.push(item);
      await foundList.save();
      res.redirect('/' + listName);
    }
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).send('Error adding item!');
  }
});

/**
 * Handle POST request to edit an item's name in a specified list or the current date list.
 * @param {string} req.body.updatedItemId - The ID of the item to update.
 * @param {string} req.body.updatedItemTitle - The new name/title for the updated item.
 * @param {string} req.body.customeListName - The name of the list in which the item exists.
 * @returns {redirect} Redirects to the home page or the specific list page after editing the item.
 * @throws {Error} Throws an error if the item cannot be updated or if there's a server error.
 */
app.post('/edit', async (req, res) => {
  const {
    updatedItemId,
    updatedItemTitle: newInput,
    customeListName: listName,
  } = req.body;

  if (!updatedItemId || !newInput) {
    return res.status(400).send('Missing updated item ID or title');
  }
  try {
    let updatedItem;
    if (listName === getLocalDate()) {
      updatedItem = await Item.findByIdAndUpdate(
        updatedItemId,
        {
          name: newInput,
        },
        { new: true } // Return the updated document
      );
      res.redirect('/');
    } else {
      updatedItem = await List.findOneAndUpdate(
        { name: listName, 'items._id': updatedItemId },
        { $set: { 'items.$.name': newInput } },
        { new: true }
      );
      res.redirect('/' + listName);
    }
  } catch (error) {
    console.log('Error editing item:', error);
    res.status(500).send('Failed to edit item');
  }
});

/**
 * Handle POST request to delete an item from a specified list or the current date list.
 * @param {string} req.body.listName - The name of the list from which the item should be deleted.
 * @param {string} req.body.checkbox - The ID of the item to delete.
 * @returns {redirect} Redirects to the home page or the specific list page after deleting the item.
 * @throws {Error} Throws an error if the item cannot be deleted or if there's a server error.
 */
app.post('/delete', async function (req, res) {
  const { listName: checkedListName, checkbox: checkedItemId } = req.body;

  if (checkedListName === getLocalDate()) {
    try {
      await Item.findByIdAndDelete(checkedItemId);
      res.redirect('/');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error deleting item!');
    }
  } else {
    try {
      await List.findOneAndUpdate(
        { name: checkedListName },
        { $pull: { items: { _id: checkedItemId } } }
      );
      res.redirect('/' + checkedListName);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting item from list!');
    }
  }
});

// Async IIFE for Initialization: The async IIFE ensures that the database connection and default item creation are completed before starting the server.
(async () => {
  try {
    const conn = await connectDB();
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Save default items asynchronously
    await createDefaultItems();

    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
