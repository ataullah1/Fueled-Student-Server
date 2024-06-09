const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 3000;

// Middleware ==============
const options = {
  origin: [
    'http://localhost:5173',
    'https://fueled-student.web.app',
    'https://fueled-student.firebaseapp.com',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
};

app.use(cors(options));
app.use(express.json());
app.use(cookieParser());

// Veryfy token
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log('verifyTokennn:', token);
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' });
  }
  jwt.verify(token, process.env.TOKEN_SEC, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    req.user = decoded;
    next();
  });
};

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.htex290.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // All DB Cullection
    const mealsCollection = client.db('fueled_student_DB').collection('meals');

    // Create an index on the 'title' field
    await mealsCollection.createIndex({ title: 1 });
    console.log('Index created on title field');

    const userCollection = client.db('fueled_student_DB').collection('users');
    const likeCollection = client.db('fueled_student_DB').collection('likes');
    const mealsRequestCollection = client
      .db('fueled_student_DB')
      .collection('meals-request');
    const reviewLikeCollection = client
      .db('fueled_student_DB')
      .collection('review-likes');
    const reviewCollection = client
      .db('fueled_student_DB')
      .collection('reviews');

    // Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SEC, {
        expiresIn: '1d',
      });
      console.log('token:', token);
      res.cookie('token', token, cookieOptions).send({ success: true });
    });

    // Cookies remove
    app.post('/logout', verifyToken, async (req, res) => {
      const user = req.body;
      console.log('Remove token');
      return res.clearCookie('token', { maxAge: 0 }).send({ success: true });
    });

    // Services related API
    // User part============

    // New user post-
    app.post('/new-user', async (req, res) => {
      const user = req.body;
      // console.log(user);
      // return;
      const query = { userEmail: user.userEmail };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        return res.send({ message: 'User Allready Exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // All user read
    app.get('/users', verifyToken, async (req, res) => {
      console.log('bal:', req.user);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Check Admin
    app.get('/user/admin/:email', async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { userEmail: email, role: 'admin' };
      const result = await userCollection.findOne(query);
      let admin = false;
      if (result?.role === 'admin') {
        admin = true;
      }
      // console.log(admin);

      res.send({ admin });
    });

    // User role change --
    app.patch('/change-user-role', async (req, res) => {
      const role = req.query.role;
      const id = req.query.id;
      // console.log('empolye:', role, '===id:', id);
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          power: role,
        },
      };
      const result = employeeCollection.updateOne(query, update);
      res.send(result);
    });

    //
    // Main part=======================
    app.post('/post-meal', async (req, res) => {
      const meal = req.body;
      // console.log(newItem);
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    app.get('/meals', async (req, res) => {
      // const page = parseInt(req.query.page);
      // const itemPer = parseInt(req.query.itemper);
      const offset = parseInt(req.query.offset);
      const limit = parseInt(req.query.limit);
      // console.log('+++++++>>>', fetchItemPer);

      const filter = req.query.filter;
      // const search = req.query.search;
      const search = req.query.search;

      let doc = {};
      // Filtering logic =======
      if (filter === 'dinner' || filter === 'breakfast' || filter === 'lunch') {
        doc = {
          mealType: filter,
        };
      } else if (
        filter === '15,20' ||
        filter === '10,15' ||
        filter === '5,10' ||
        filter === '0,5'
      ) {
        const filArr = filter.split(',');
        const filter1 = parseInt(filArr[0]);
        const filter2 = parseInt(filArr[1]);
        doc = {
          price: {
            $gte: filter1,
            $lte: filter2,
          },
        };
      }

      try {
        let result;
        if (search) {
          const query = {
            // description: { $regex: filter, $options: 'i' },
            title: { $regex: search, $options: 'i' },
          };
          result = await mealsCollection
            .find(query)
            .skip(limit * offset)
            .limit(limit)
            .toArray();
        } else {
          // Use the find method for filtering
          result = await mealsCollection
            .find(doc)
            .skip(limit * offset)
            .limit(limit)
            .toArray();
        }
        res.send(result);
      } catch (error) {
        console.error('Error occurred while fetching the meals:', error);
        res.status(500).send('An error occurred while fetching the meals.');
      }
    });

    // Meals total length
    app.get('/meals-len', async (req, res) => {
      const result = await mealsCollection.estimatedDocumentCount();
      const finalRes = result;
      // console.log(finalRes);
      res.send({ finalRes });
    });

    app.get('/meals-six', async (req, res) => {
      const result = await mealsCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get('/breakfast', async (req, res) => {
      const query = { mealType: 'breakfast' };
      const result = await mealsCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get('/lunch', async (req, res) => {
      const query = { mealType: 'lunch' };
      const result = await mealsCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get('/dinner', async (req, res) => {
      const query = { mealType: 'dinner' };
      const result = await mealsCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get('/details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    // user like post counting
    app.put('/like-count', async (req, res) => {
      const data = req.body;
      // console.log(data);
      const postId = data.id;
      const count = data.count;
      const query = { _id: new ObjectId(postId) };
      // console.log('count value:', count, 'id:', postId);
      const doc = { $inc: { likes: count } };
      const result = await mealsCollection.updateOne(query, doc);

      const countLike = data.liked;
      const email = data.email;
      const filter = { email: email, postId: postId };
      const options = { upsert: true };
      const updateDoc = {
        $set: { countLike, email, postId },
      };
      const colorResult = await likeCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      // if (colorResult.upsertedCount > 0) {
      //   console.log(
      //     `A new document was inserted with the _id: ${colorResult.upsertedId}`
      //   );
      // } else if (colorResult.modifiedCount > 0) {
      //   console.log(`An existing document was updated`);
      // } else {
      //   console.log(`No document was modified or inserted`);
      // }
      res.send({ result, colorResult });
    });
    // Like select or not select
    app.get('/liked-count', async (req, res) => {
      const id = req.query.id;
      const email = req.query.email;
      const query = { postId: id, email: email };
      const result = await likeCollection.findOne(query);
      let likedd = false;
      if (result?.countLike === 1) {
        likedd = true;
      } else {
        likedd = false;
      }
      res.send(likedd);
    });
    // add review post
    app.post('/post-review', async (req, res) => {
      const review = req.body;
      console.log(review);
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    // add review post
    app.put('/review-update/:id', async (req, res) => {
      const review = req.body;
      const filter = { _id: new ObjectId(req.params.id) };
      // console.log(review);
      const doc = {
        $set: {
          ...review,
        },
      };
      const result = await reviewCollection.updateOne(filter, doc);
      res.send(result);
    });
    // review read by my post
    app.get('/read-my-review/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const query = { reviewUserEmail: email };
        const myReviewArr = await reviewCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        // Ensure that we have requests
        if (myReviewArr.length === 0) {
          return res.status(404).send([]);
        }

        // Extract recMealIds from requests and convert them to ObjectId
        const recMealIds = myReviewArr.map(
          (review) => new ObjectId(review.postId)
        );

        // Query the meals collection with the array of recMealIds
        const queryMeal = { _id: { $in: recMealIds } };
        const mealsArray = await mealsCollection.find(queryMeal).toArray();

        // Create a lookup object from mealsArray
        const mealsLookup = mealsArray.reduce((acc, meal) => {
          acc[meal._id.toString()] = meal;
          return acc;
        }, {});

        // Merge the arrays and adjust the structure as required
        const finalResult = myReviewArr.map((review) => {
          const meal = mealsLookup[review.postId];
          if (meal) {
            // Combine the review and meal objects, remove original _id and meal rating
            const { _id, rating, ...mealData } = meal;
            return {
              ...review,
              ...mealData,
              _id: review._id, // retain the original review _id
            };
          }
          return review;
        });

        // console.log(finalResult);
        res.send(finalResult);
      } catch (error) {
        console.error('Error fetching meal data:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    // review post read
    app.get('/read-review/:id', async (req, res) => {
      const query = { postId: req.params.id };
      const result = await reviewCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });
    // My review delete
    app.delete('/delete-review/:id', async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });
    // Sum of all rating
    app.get('/sum-of-rating/:id', async (req, res) => {
      try {
        const doc = [
          { $match: { postId: req.params.id } },
          {
            $group: {
              _id: null,
              totalRating: { $sum: '$rating' },
              totalCount: { $sum: 1 },
            },
          },
        ];
        const result = await reviewCollection.aggregate(doc).toArray();
        if (result.length > 0) {
          const totalRating = result[0].totalRating;
          const totalCount = result[0].totalCount;
          const averageRating = totalCount > 0 ? totalRating / totalCount : 0;
          res.json({
            totalRating: totalRating,
            totalCount: totalCount,
            averageRating: averageRating,
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Meals Request
    app.post('/meals-request', async (req, res) => {
      const request = req.body;
      // console.log(request);
      const query = {
        recEmail: request.recEmail,
        recMealId: request.recMealId,
      };
      const existRec = await mealsRequestCollection.findOne(query);
      if (existRec) {
        return res.send({
          message: 'Request Allready Exists',
          insertedId: null,
        });
      }
      const result = await mealsRequestCollection.insertOne(request);
      res.send(result);
    });

    app.get('/request-meals/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const query = { recEmail: email };
        const requestsArray = await mealsRequestCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        // Ensure that we have requests
        if (requestsArray.length === 0) {
          return res.status(404).send([]);
        }

        // Extract recMealIds from requests and convert them to ObjectId
        const recMealIds = requestsArray.map(
          (request) => new ObjectId(request.recMealId)
        );

        // Query the meals collection with the array of recMealIds
        const queryMeal = { _id: { $in: recMealIds } };
        const mealsArray = await mealsCollection.find(queryMeal).toArray();

        // Create a lookup object from mealsArray
        const mealsLookup = mealsArray.reduce((acc, meal) => {
          acc[meal._id.toString()] = meal;
          return acc;
        }, {});

        // Merge the arrays and adjust the structure as required
        const finalResult = requestsArray.map((request) => {
          const meal = mealsLookup[request.recMealId];
          if (meal) {
            // Combine the request and meal objects, remove original _id
            const { _id, ...mealData } = meal;
            return {
              ...request,
              ...mealData,
              _id: request._id, // retain the original request _id
            };
          }
          return request;
        });

        // console.log(finalResult);
        res.send(finalResult);
      } catch (error) {
        console.error('Error fetching meal data:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    app.delete('/cancel-req/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await mealsRequestCollection.deleteOne(query);
      res.send(result);
    });

    // app.get('/orderDta/:email', async (req, res) => {
    //   const email = req.params.email;
    //   const query = { userEmail: email };
    //   const result = await orderCollection.find(query).toArray();
    //   res.send(result);
    // });

    // app.patch('/order-update', async (req, res) => {
    //   const id = req.query.id;
    //   const statusDta = req.query.status;
    //   // console.log('id:', id, '  status: ', statusDta);
    //   const query = { _id: new ObjectId(id) };
    //   const docUpdate = {
    //     $set: {
    //       status: statusDta,
    //     },
    //   };
    //   const result = orderCollection.updateOne(query, docUpdate);
    //   res.send(result);
    // });

    // app.put('/update-item', async (req, res) => {
    //   const updateItem = req.body;
    //   const filter = { _id: req.query.id };
    //   // console.log({ ...updateItem });
    //   // return
    //   const updateDoc = {
    //     $set: { ...updateItem },
    //   };
    //   const result = await menuCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });

    // app.delete('../:id', async (req, res) => {
    //   const id = req.params.id;
    //   // console.log(id);
    //   const query = { _id: new ObjectId(id) };
    //   const result = await orderCollection.deleteOne(query);
    //   res.send(result);
    // });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('PYou successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
