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
    const userCollection = client.db('fueled_student_DB').collection('users');
    const mealsCollection = client.db('fueled_student_DB').collection('meals');
    const likeCollection = client.db('fueled_student_DB').collection('likes');
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
      // const page = parseInt(req.query.page) || 1;
      // const itemPer = parseInt(req.query.itemper) || 5;
      // const fetchItemPer = page * itemPer;
      // console.log('+++++++>>>', page, itemPer);

      let doc = {};
      const filter = req.query.filter;
      const search = req.query.search;
      // Aggregate Pipeline for search
      const aggregate = [
        {
          $search: {
            index: 'meals-search',
            text: {
              query: search,
              path: {
                wildcard: '*',
              },
            },
          },
        },
      ];

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
          console.log('bal', search, aggregate);
          // Apply the aggregation pipeline for searchss
          result = await mealsCollection.aggregate(aggregate).toArray();
        } else {
          // Use the find method for filtering
          result = await mealsCollection.find(doc).toArray();
        }
        res.send(result);
      } catch (error) {
        console.log('Bal error khyco tui');
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
    // review post read
    app.get('/read-review/:id', async (req, res) => {
      const query = { postId: req.params.id };
      const result = await reviewCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
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
