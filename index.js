const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const nodemailer = require('nodemailer');
const port = process.env.PORT || 8000;
// Middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://stay-vista-a5a22.web.app',
    'https://stay-vista-a5a22.firebaseapp.com',
    'https://stay-vista-server-alpha.vercel.app',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
// send email
// const sendEmail = (emailAddress, emailData) => {
//   const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false,
//     auth: {
//       user: process.env.TRANSPORTER_EMAIL,
//       pass: process.env.TRANSPORTER_PASS,
//     },
//   });
//   transporter.verify(function (error, success) {
//     if (error) {
//       console.log(error);
//     } else {
//       console.log('Server is ready to take our messages');
//     }
//   });
//   const mailBody = {
//     from: `"StayVista" <${process.env.TRANSPORTER_EMAIL}>`, // sender address
//     to: emailAddress,
//     subject: emailData.subject,
//     html: emailData.message,
//   };

//   transporter.sendMail(mailBody, (error, info) => {
//     if (error) {
//       console.log(error);
//     } else {
//       console.log('Email Sent: ' + info.response);
//     }
//   });
// };
// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
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
    // await client.connect();
    const roomCollection = client.db('stayvista').collection('rooms');
    const usersCollection = client.db('stayvista').collection('users');
    const bookingCollection = client.db('stayvista').collection('bookings');
    const reviewsCollection = client.db('stayvista').collection('reviews');
    // middleware for admin route
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const filter = { email: user?.email };
      const result = await usersCollection.findOne(filter);
      if (!result || result?.role !== 'admin') {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      next();
    };
    // middleware for host route
    const verifyHost = async (req, res, next) => {
      const user = req.user;
      const filter = { email: user?.email };
      const result = await usersCollection.findOne(filter);
      if (!result || result?.role !== 'host') {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      next();
    };
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

    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      // generate clientSecret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: 'usd',
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // send client secret as response
      res.send({ clientSecret: client_secret });
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

    app.get(
      '/my-listings/:email',
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const query = { 'host.email': email };
        const result = await roomCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.post('/add-room', verifyToken, verifyHost, async (req, res) => {
      const room = req.body;
      const result = await roomCollection.insertOne(room);
      res.send(result);
    });

    app.put('/room/update/:id', verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const roomData = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: roomData,
      };
      const result = await roomCollection.updateOne(query, updateDoc);
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
    app.delete('/room/:id', verifyToken, verifyHost, async (req, res) => {
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
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/search', async (req, res) => {
      const queryText = req.query;
      let query = {};

      if (queryText.query) {
        query = {
          $or: [
            { title: { $regex: queryText.query, $options: 'i' } },
            { location: { $regex: queryText.query, $options: 'i' } },
          ],
        };
      }

      const result = await roomCollection.find(query).toArray();
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
        } else if (user.phoneNumber) {
          const result = await usersCollection.updateOne(filter, {
            $set: { phoneNumber: user.phoneNumber },
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
      //       sendEmail(user?.email, {
      //         subject: 'Welcome to Stayvista!',
      //         message: `
      //   <div style="text-align: center; padding: 1.5rem; background-color: #F9FAFB; border-radius: 0.5rem; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
      //   <p style="background-color:#FF7473;padding:20px 20px 10 20px;">
      //     <img src="https://i.postimg.cc/13rFBgXg/logo-removebg-preview-1.png" alt="Stay Vista Logo" style="width: 200px; margin-bottom: 1rem;">
      //     </p>
      //     <h1 style="font-size: 1.5rem; font-weight: bold; color: #1B1F3B; margin-bottom: 0.75rem;">
      //       Welcome to Stay Vista!
      //     </h1>
      //     <p style="font-size: 1rem; color: #4B5563; margin-bottom: 1.25rem;">
      //       Your journey to a perfect stay starts here.
      //     </p>
      //     <a href="https://stay-vista-a5a22.web.app"
      //        style="display: inline-block; background-color: #1B1F3C; color: #FFFFFF; font-weight: 600; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; transition: background-color 0.3s;">
      //       Discover Now
      //     </a>
      //   </div>
      // `,
      //       });
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

    // booking collection route
    app.post('/booking', verifyToken, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      // // send email to guest
      // sendEmail(booking?.guest?.email, {
      //   subject: 'Booking Successful!',
      //   message: `<p>Thank you for booking with Stay Vista! Your reservation is confirmed. Transaction ID: ${booking.transactionId}. We look forward to hosting you!
      //   </p>
      //   <p style="background-color:#FF7473;padding:20px 20px 10 20px;">
      //     <img src="https://i.postimg.cc/13rFBgXg/logo-removebg-preview-1.png" alt="Stay Vista Logo" style="width: 200px; margin-bottom: 1rem;">
      //   </p>
      //   `,
      // });
      // // send email to host
      // sendEmail(booking?.host?.email, {
      //   subject: 'Your room got booked!',
      //   message: `<p> You're all set to welcome ${booking.guest.name}! Thank you for partnering with Stay Vista.
      //   </p>
      //   <p style="background-color:#FF7473;padding:20px 20px 10 20px;">
      //     <img src="https://i.postimg.cc/13rFBgXg/logo-removebg-preview-1.png" alt="Stay VistaLogo" style="width: 200px; margin-bottom: 1rem;">
      //     </p>
      //   `,
      // });
      res.send(result);
    });
    app.delete('/booking/cancel/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { roomId: id };
      const result = bookingCollection.deleteOne(query);
      res.send(result);
    });
    app.get('/booking/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { 'guest.email': email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });
    app.get(
      '/manage-booking/:email',
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const query = { 'host.email': email };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      }
    );
    app.patch('/room/status/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const result = await roomCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // statistics data route starts here
    app.get('/admin-stat', verifyToken, verifyAdmin, async (req, res) => {
      const bookingDetails = await bookingCollection
        .find(
          {},
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();

      const totalUsers = await usersCollection.countDocuments();
      const totalRooms = await roomCollection.countDocuments();
      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      );
      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate();
        const month = new Date(booking.date).getMonth() + 1;
        const data = [`${day}/${month}`, booking?.price];
        return data;
      });
      chartData.unshift(['Day', 'Sales']);
      // chartData.splice(0, 0, ['Day', 'Sales'])

      res.send({
        totalUsers,
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
      });
    });

    // Host Statistics
    app.get('/host-stat', verifyToken, verifyHost, async (req, res) => {
      const { email } = req.user;
      const bookingDetails = await bookingCollection
        .find(
          { 'host.email': email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();

      const totalRooms = await roomCollection.countDocuments({
        'host.email': email,
      });
      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      );
      const { timestamp } = await usersCollection.findOne(
        { email },
        { projection: { timestamp: 1 } }
      );

      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate();
        const month = new Date(booking.date).getMonth() + 1;
        const data = [`${day}/${month}`, booking?.price];
        return data;
      });
      chartData.unshift(['Day', 'Sales']);
      // chartData.splice(0, 0, ['Day', 'Sales'])

      res.send({
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        hostSince: timestamp,
      });
    });

    // Guest Statistics
    app.get('/guest-stat', verifyToken, async (req, res) => {
      const { email } = req.user;
      const bookingDetails = await bookingCollection
        .find(
          { 'guest.email': email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();

      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      );
      const { timestamp } = await usersCollection.findOne(
        { email },
        { projection: { timestamp: 1 } }
      );

      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate();
        const month = new Date(booking.date).getMonth() + 1;
        const data = [`${day}/${month}`, booking?.price];
        return data;
      });
      chartData.unshift(['Day', 'Sales']);
      // chartData.splice(0, 0, ['Day', 'Sales'])

      res.send({
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        guestSince: timestamp,
      });
    });
    app.post('/review', verifyToken, async (req, res) => {
      try {
        const {
          id: roomId,
          review,
          rating,
          userEmail,
          userName,
          photoURL,
        } = req.body;

        if (!roomId || !review || !rating || !userEmail) {
          return res.status(400).send({ message: 'Missing required fields' });
        }

        // Verify the user has booked the room
        const booking = await bookingCollection.findOne({
          roomId,
          'guest.email': userEmail,
        });

        if (!booking) {
          return res
            .status(403)
            .send({ message: 'You have not booked this room' });
        }

        // Check if the user already reviewed this room
        const existingReview = await reviewsCollection.findOne({
          roomId,
          'user.email': userEmail,
        });

        if (existingReview) {
          return res
            .status(409)
            .send({ message: 'You have already reviewed this room' });
        }

        // Insert the review
        const result = await reviewsCollection.insertOne({
          roomId,
          review,
          rating,
          user: {
            email: userEmail,
            name: userName,
            photo: photoURL,
          },
          date: new Date(),
        });

        return res.status(200).send({
          message: 'Review submitted successfully',
          insertedId: result.insertedId,
        });
      } catch (err) {
        console.error('Error submitting review:', err);
        return res.status(500).send({ message: 'Server error' });
      }
    });
    app.get('/review/:roomId', async (req, res) => {
      const { roomId } = req.params;

      if (!roomId) {
        return res.status(400).send({ message: 'Room ID is required' });
      }

      try {
        const reviews = await reviewsCollection
          .find({ roomId })
          .sort({ date: -1 }) // newest first
          .toArray();

        res.status(200).send(reviews);
      } catch (err) {
        console.error('Error fetching room reviews:', err);
        res.status(500).send({ message: 'Server error' });
      }
    });
    app.get('/review', async (req, res) => {
      try {
        const reviews = await reviewsCollection
          .find({})
          .sort({ date: -1 }) // newest reviews first
          .toArray();

        res.status(200).send(reviews);
      } catch (err) {
        console.error('Error fetching all reviews:', err);
        res
          .status(500)
          .send({ message: 'Server error while fetching reviews' });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
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
