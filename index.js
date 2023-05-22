const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 3000;

// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cnuoch3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// verify token function here
const verifyJWT = (req, res, next) => {
  console.log('verify hitting in jwt')
  console.log(req.headers.authorization);
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(402).send({ error: true, message: 'unauthorized your token' })
  }
  const token = authorization.split(' ')[1];
  console.log('token inside verify:', token)
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(403).send({ error: true, message: 'unAthorized access' })
    }
    req.decoded = decoded;
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // collection
    const servicesCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('booking');


    // search text code
    const indexKeys = { services: 1, price: 1}
    const indexOptions = { name: "servicesPrice" }
    const result = await bookingCollection.createIndex(indexKeys, indexOptions)
    console.log(result)

    app.get('/bookingSearchServices/:text', async (req, res) => {
      const searchText = req.params.text;
      const result = await bookingCollection.find({
        $or: [
          { services: { $regex: searchText, $options: "i"} },
          { price: { $regex: searchText, $options: "i"} }
        ],
      }).toArray();
      res.send(result) 
    })

    // jwt 
    app.post('/jwt', (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      console.log(token)
      res.send({ token })
    })

    // services route
    app.get('/services', async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      // const query = {};
      // const query = {price: {$lt: 100}}
      const query = {title: {$regex: search, $options: 'i'}}
      const options = {
        sort:  {
          "price" : sort === 'asc' ? 1 : -1
        }
      };
      const cursor = servicesCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {

        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await servicesCollection.findOne(query, options);
      res.send(result)
    })

    // bookings routes

    app.get('/bookings', verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      console.log('come back after verify', decoded);

      if (decoded.email !== req.query.email) {
        return res.status(403).send({ error: 1, message: 'forbidden verify' })
      }

      let query = {}
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking)
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedBookings = req.body;
      console.log(updatedBookings)

      const updateDoc = {
        $set: {
          status: updatedBookings.status
        },
      };

      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Car doctors is coming...')
})

app.listen(port, (req, res) => {
  console.log(`Car doctor server port is: ${port}`)
})