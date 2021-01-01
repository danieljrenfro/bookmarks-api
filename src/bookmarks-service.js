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
  }
};

module.exports = BookmarksService;