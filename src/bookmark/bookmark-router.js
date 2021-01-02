const express = require('express');
const xss = require('xss');

const logger = require('../logger');
const BookmarksService = require('./bookmarks-service.js');

const bookmarkRouter = express.Router();
const bodyParser = express.json();

bookmarkRouter
  .route('/bookmarks')
  .get((req, res, next) => {
    const db = req.app.get('db');

    return BookmarksService.getAllBookmarks(db)
      .then(bookmarks => {
        const sanitizedBookmarks = bookmarks.map(bookmark => {
          return {
            id: bookmark.id,
            title: xss(bookmark.title),
            url: bookmark.url,
            description: xss(bookmark.description),
            rating: bookmark.rating
          };
        });
        res.json(sanitizedBookmarks);
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;
    const db = req.app.get('db');
    const requiredFields = { title, url, rating };

    for(const [key, value] of Object.entries(requiredFields)) {
      if (value == null || value === '') {
        return res.status(400).json({
          error: { message: `${key} is required`}
        });
      }
    }

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      logger.error('Bookmark url is required and must begin with http(s)://');
      return res
        .status(400)
        .json({
          error: { message: 'Url should begin with http(s)://'}
        });
    }

    const numRating = parseFloat(rating);

    if (!numRating || isNaN(numRating) || (numRating < 1 || numRating > 5)) {
      logger.error('Bookmark rating is required and must be a number between 1 and 5');
      return res
        .status(400)
        .json({
          error: { message: 'rating must be a number between 1 and 5' }
        });
    }

    const newBookmark = {
      description: xss(description),
      rating: rating, 
      title: xss(title),
      url: url
    };

    BookmarksService.insertBookmark(db, newBookmark)
      .then(bookmark => {
        res
          .status(201)
          .location(`/bookmarks/${bookmark.id}`)
          .json(bookmark);
      })
      .catch(next);
  });

bookmarkRouter
  .route('/bookmarks/:id')
  .all((req, res, next) => {
    BookmarksService.getById(
      req.app.get('db'),
      req.params.id
    )
      .then(bookmark => {
        if (!bookmark) {
          return res
            .status(404)
            .json({
              error: { message: `Bookmark doesn't exist` }
            });
        }
        res.bookmark = bookmark;
        next();
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json({
      id: res.bookmark.id,
      title: xss(res.bookmark.title),
      url: res.bookmark.url,
      description: xss(res.bookmark.description),
      rating: res.bookmark.rating
    });
  })
  .delete((req, res, next) => {
    const id = req.params.id;
    const db = req.app.get('db');

    BookmarksService.deleteBookmark(db, id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = bookmarkRouter;