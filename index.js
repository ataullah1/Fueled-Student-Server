const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 3000;

// Middleware ==============
const options = {
  origin: [
    'http://localhost:5173',
    'https://office-lunch-menu.web.app',
    'https://office-lunch-menu.firebaseapp.com',
  ],
  optionsSuccessStatus: 200,
};
app.use(cors(options));
app.use(express.json());

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
    const userCollection = client.db('dbname').collection('users');

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
    app.get('/users', async (req, res) => {
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
    // Main part===========
    app.post('/add-item', async (req, res) => {
      const newItem = req.body;
      // console.log(newItem);
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });

    app.get('/orders', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });
    app.get('/orderDta/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/order-update', async (req, res) => {
      const id = req.query.id;
      const statusDta = req.query.status;
      // console.log('id:', id, '  status: ', statusDta);
      const query = { _id: new ObjectId(id) };
      const docUpdate = {
        $set: {
          status: statusDta,
        },
      };
      const result = orderCollection.updateOne(query, docUpdate);
      res.send(result);
    });
    app.put('/update-item', async (req, res) => {
      const updateItem = req.body;
      const filter = { _id: req.query.id };
      // console.log({ ...updateItem });
      // return
      const updateDoc = {
        $set: { ...updateItem },
      };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('../:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

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
