require('dotenv').config();
const { expect } = require('chai');
const supertest = require('supertest');
const knex = require('knex');
const app = require('../src/app');
const { makeBookmarksArray, createBookmarkObject, makeMaliciousBookmark } = require('./bookmarks.fixtures');

describe.only('Bookmarks Endpoints', function() {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db);
  });

  before('clean the table', () => db('bookmarks').truncate());

  after('disconnect from db', () => db.destroy());

  afterEach('clean the table', () => db('bookmarks').truncate());

  describe('Token Validation Middleware', () => {
    it('responds with 401 when incorrect API token provided', () => {
      return supertest(app)
        .get('/bookmarks')
        .set('Authorization', 'Bearer incorrect-token')
        .expect(401, { error: 'Unauthorized request' });
    });
  
    it('responds with 401 when no API token provided', () => {
      return supertest(app)
        .get('/bookmarks')
        .expect(401, { error: 'Unauthorized request' });
    });
  });

  describe('GET /bookmarks', () => {
    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();
  
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('responds with 200 and an array of bookmarks', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
      
    });

    context('Given the database is empty', () => {
      it('responds with 200 and an empty array', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, []);
      });
    });

    context('Given an XSS attack', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert(maliciousBookmark);
      });

      it('removes XSS attack from bookmark', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .then(res => {
            expect(res.body[0].title).to.eql(expectedBookmark.title);
            expect(res.body[0].description).to.eql(expectedBookmark.description)
          });
      });
    });
  });

  describe('GET /bookmarks/:id', () => {
    context('Given the database has bookmarks', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('sends a 200 status with the individual bookmark', () => {
        const bookmarkId = 3;
        const expectedBookmark = testBookmarks[bookmarkId - 1];

        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });

    context('Given the database is empty', () => {
      it('should send a 404 status with error object', () => {
        const bookmarkId = 3;

        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: `Bookmark doesn't exist` }});
      });
    });

    context('Given XSS attack', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
      const id = maliciousBookmark.id;

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert(maliciousBookmark);
      });

      it('removes XSS attack from bookmark', () => {
        return supertest(app)
          .get(`/bookmarks/${id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .then(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.description).to.eql(expectedBookmark.description);
          });
      });

    });
  });
  
  describe('POST /bookmarks', () => {
    it('responds with 201 and the newly created bookmark', () => {
      const newBookmark = createBookmarkObject();
      
      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(201)
        .then(res => {
          const bookmark = res.body;
          expect(res.headers.location).to.eql(`/bookmarks/${bookmark.id}`);
          expect(bookmark.id).to.eql(1);
          expect(bookmark.title).to.eql(newBookmark.title);
          expect(bookmark.url).to.eql(newBookmark.url);
          expect(bookmark.description).to.eql(newBookmark.description);
          expect(bookmark.rating).to.eql(newBookmark.rating);
        });
    });

    const requiredFields = ['title', 'url', 'rating'];

    describe('validates for required fields', () => {
      requiredFields.forEach(field => {
        const newBookmark = createBookmarkObject();
        
        delete newBookmark[field];
  
        it(`responds with 400 and '${field}' required`, () => {
          return supertest(app)
            .post('/bookmarks')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(newBookmark)
            .expect(400, {
              error: { message: `${field} is required` }
            });
        });
      });
    });

    describe('validates for empty strings of required fields', () => {
      requiredFields.forEach(field => {
        let newBookmark = createBookmarkObject();
        
        newBookmark[field] = '';

        it(`responds with 400 and ${field} is required`, () => {
          return supertest(app)
            .post('/bookmarks')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(newBookmark)
            .expect(400, {
              error: { message: `${field} is required` }
            });
        });
      });
    });

    it('responds with 400 and error message when url doesn\'t begin with http', () => {
      let newBookmark = createBookmarkObject();
      newBookmark.url = 'www.google.com';

      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(400, {
          error: { message: 'Url should begin with http(s)://'}
        });
    });
    
    it('responds with 400 and error message when rating is not a number', () => {
      let newBookmark = createBookmarkObject();
      newBookmark.rating = 'one';

      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(400, {
          error: { message: 'rating must be a number between 1 and 5' }
        });
    });

    it('responds with 400 and error message when rating is greater than 5', () => {
      let newBookmark = createBookmarkObject();
      newBookmark.rating = 7;

      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(400, {
          error: { message: 'rating must be a number between 1 and 5' }
        });
    });

    it('responds with 400 and error message when rating is not a number', () => {
      let newBookmark = createBookmarkObject();
      newBookmark.rating = 0;

      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(400, {
          error: { message: 'rating must be a number between 1 and 5' }
        });
    });

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      it('removes XSS attack content', () => {
        return supertest(app)
          .post('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(maliciousBookmark)
          .expect(201)
          .then(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.description).to.eql(expectedBookmark.description);
          });
      });
    });
  });

  describe('DELETE /bookmarks/:id', () => {
    context('Given the database has data', () => {
      const testBookmarks = makeBookmarksArray();
      
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('responds with 204 when item found and deleted', () => {
        const idToRemove = 2;
        const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove);

        return supertest(app)
          .delete(`/bookmarks/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(() => {
            return supertest(app)
              .get('/bookmarks')
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmarks);
          });
      });

      it('responds with 404 "bookmark doesn\'t exist" for wrong id', () => {
        const idToRemove = 123456;

        return supertest(app)
          .delete(`/bookmarks/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, {
            error: { message: `Bookmark doesn't exist` }
          });
      });
    });
  });
});