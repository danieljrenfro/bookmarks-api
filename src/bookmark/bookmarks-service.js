const BookmarksService = {
  getAllBookmarks(db) {
    return db
      .select('*')
      .from('bookmarks');
  },
  getById(db, id) {
    return db
      .select('*')
      .from('bookmarks')
      .where({ id })
      .first();
  },
  insertBookmark(db, bookmark) {
    return db
      .insert(bookmark)
      .into('bookmarks')
      .returning('*')
      .then(rows => {
        return rows[0];
      });
  }, 
  deleteBookmark(db, id) {
    return db
      .from('bookmarks')
      .where({ id })
      .delete();
  },
  updateBookmark(db, id, updatedBookmark) {
    return db
      .from('bookmarks')
      .where({ id })
      .update(updatedBookmark);
  }
};

module.exports = BookmarksService;