const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const port = 8000;
// Middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kj2w8eq.mongodb.net/stayvista?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    const roomCollection = client.db('stayvista').collection('rooms');
    const usersCollection = client.db('stayvista').collection('users');

    // middleware for admin route
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const filter = { email: user?.email };
      const result = await usersCollection.findOne(filter);
      if (!result || result?.role !== 'admin') {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      next();
    }
    // middleware for host route
    const verifyHost = async (req, res, next) => {
      const user = req.user;
      const filter = { email: user?.email };
      const result = await usersCollection.findOne(filter);
      if (!result || result?.role !== 'host') {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      next();
    }
    // Auth-related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true });
        console.log('Logout successful');
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Get all room collection routes
    app.get('/rooms', async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category && category !== 'null') {
        query = { category };
      }
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/my-listings/:email',verifyToken,verifyHost, async (req, res) => {
      const email = req.params.email;
      const query = { 'host.email': email };
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/add-room',verifyToken, verifyHost, async (req, res) => {
      const room = req.body;
      const result = await roomCollection.insertOne(room);
      res.send(result);
    });
    // get single room
    app.get('/room/:id', async (req, res) => {
      const roomId = req.params.id;
      const room = await roomCollection.findOne({ _id: new ObjectId(roomId) });
      if (!room) {
        return res.status(404).send('Room not found');
      }
      res.send(room);
    });
    // delete single room
    app.delete('/room/:id',verifyToken,verifyHost, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = roomCollection.deleteOne(query);
      res.send(result);
    });
    // get single user
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });
    app.get('/users',verifyToken,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // add new user
    app.put('/user', async (req, res) => {
      const user = req.body;
      const filter = { email: user?.email };
      const isExist = await usersCollection.findOne(filter);
      if (isExist) {
        if (user.status === 'Requested') {
          const result = await usersCollection.updateOne(filter, {
            $set: { status: user.status },
          });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // update user role
    app.patch('/user/update-role/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };

      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  } finally {
    // Optionally handle the client closure
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..');
});

app.listen(port, () => {
  console.log(`Stay Vista server listening on port ${port}`);
});
