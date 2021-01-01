require('dotenv').config();
const { expect } = require('chai');
const supertest = require('supertest');
const knex = require('knex');
const app = require('../src/app');
const bookmarks = require('../src/store');
const { makeBookmarksArray } = require('./bookmarks.fixtures');

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
  });
});



describe('POST /bookmarks endpoint', () => {
  let newBookmark;
  let numberOfBookmarks = bookmarks.length;
  
  beforeEach(function() {
    newBookmark = {
      name: "Google",
      url: "https://www.google.com",
      description: "",
      rating: "5"
    };
  });
    

  it('responds with 201 and the newly created bookmark', () => {

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(201)
      .then(res => {
        expect(res.body).to.have.keys('id', 'name', 'url', 'description', 'rating');
        expect(bookmarks.length).to.equal(numberOfBookmarks + 1);
      });
  });

  it('responds with 400 and "Invalid Request" when there is no name', () => {
    delete newBookmark["name"];
    
    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when the name is empty', () => {
    newBookmark.name = '';

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when there is no url', () => {
    delete newBookmark["url"];

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when url is empty', () => {
    newBookmark['url'] = '';

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when url doesn\'t begin with http', () => {
    newBookmark['url'] = 'www.google.com';

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when there is no rating', () => {
    delete newBookmark['rating'];

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when rating is not a number', () => {
    newBookmark['rating'] = 'one';

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });

  it('responds with 400 and "Invalid Request" when rating is not a number between 1 and 5', () => {
    newBookmark['rating'] = 7;

    return supertest(app)
      .post('/bookmark')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(newBookmark)
      .expect(400, 'Invalid Request');
  });
});

describe('GET /bookmarks/:id endpoint', () => {
  it('should send a 404 status with "Not Found"', () => {
    return supertest(app)
      .get('/bookmark/fakeid')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .expect(404, 'Not Found');
  });
});

describe('DELETE /bookmarks/:id endpoint', () => {
  before(function() {
    const bookmark = {
      id: 'testid1',
      name: 'Google',
      url: 'https://google.com',
      description: '',
      rating: '1'
    };
    
    return supertest(app)
      .post('/bookmarks')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .send(bookmark);
  });

  it('should send a 204 status when item found and deleted', () => {
    const originalNumberOfBookmarks = bookmarks.length;
    
    return supertest(app)
      .delete('/bookmark/testid1')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .expect(204)
      .then(res => {
        expect(bookmarks.length).to.equal(originalNumberOfBookmarks - 1);
      });
  });

  it('should send a 404 status when item to be deleted not found', () => {
    return supertest(app)
      .delete('/bookmarks/wrongid')
      .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
      .expect(404, 'Not Found');
  });
});