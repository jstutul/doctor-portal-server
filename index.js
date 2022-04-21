const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

// const serviceAccount = require("./doctor-portal-firebase-adminsdk.json");
const serviceAccount = {
  type: "service_account",
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key,
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.client_x509_cert_url,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
//middleware
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qghp6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}
async function run() {
  try {
    await client.connect();
    const database = client.db("doctor_portal");
    const appoinmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      console.log(date);
      const query = {
        email: email,
        date: date,
      };
      console.log(query);
      const cursor = appoinmentsCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appoinmentsCollection.insertOne(appointment);
      console.log(appointment);
      res.json(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = {
        email: user.email,
      };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateMany(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(401)
          .json({ message: "you don not have accees to make admin" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctor Portal");
});

app.listen(port, () => {
  console.log(`Port listening on ${port}`);
});
