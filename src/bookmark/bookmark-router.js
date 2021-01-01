const express = require('express');
const { v4: uuid } = require('uuid');

const logger = require('../logger');
const bookmarks = require('../store');
const BookmarksService = require('../bookmarks-service.js');

const bookmarkRouter = express.Router();
const bodyParser = express.json();

bookmarkRouter
  .route('/bookmarks')
  .get((req, res, next) => {
    const db = req.app.get('db');

    return BookmarksService.getAllBookmarks(db)
      .then(bookmarks => {
        res.json(bookmarks);
      })
      .catch(next);
  })
  .post(bodyParser, (req, res) => {
    const { id, name, url, description, rating } = req.body;
    const newId = uuid();

    if (!name) {
      logger.error('Bookmark name is required');
      return res
        .status(400)
        .send('Invalid Request');
    }

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      logger.error('Bookmark url is required and must begin with http(s)://');
      return res
        .status(400)
        .send('Invalid Request');
    }

    const numRating = parseFloat(rating);

    if (!numRating || isNaN(numRating) || (numRating < 1 || numRating > 5)) {
      logger.error('Bookmark rating is required and must be a number between 1 and 5');
      return res
        .status(400)
        .send('Invalid Request');
    }

    const newBookmark = {
      id: id || newId,
      name,
      url,
      description,
      rating
    };

    bookmarks.push(newBookmark);
    
    res
      .status(201)
      .json(newBookmark);
  });

bookmarkRouter
  .route('/bookmarks/:id')
  .get((req, res, next) => {
    const db = req.app.get('db');
    const id = req.params.id;

    return BookmarksService.getById(db, id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error('Could not find a bookmark with that id');
          return res
            .status(404)
            .json({ error: { message: `Bookmark doesn't exist` }});
        }
        return res.json(bookmark);
      });
  })
  .delete((req, res) => {
    const id = req.params.id;
    const bookmarkToBeDeleted = bookmarks.find(bookmark => bookmark['id'] === id);
    const bookmarkIndex = bookmarks.findIndex(bookmark => bookmark['id'] === id);

    if (!id) {
      logger.error('Must include an id for bookmark to be deleted');
      return res 
        .status(400)
        .send('Invalid Request');
    }
    
    if (!bookmarkToBeDeleted) {
      logger.error('Cannot find bookmark with that id');
      return res
        .status(404)
        .send('Not Found');
    }

    bookmarks.splice(bookmarkIndex, 1);
    
    res
      .status(204)
      .send();
  });
module.exports = bookmarkRouter;