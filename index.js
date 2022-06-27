import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";

const client = new MongoClient("mongodb://127.0.0.1:27017");
let db;

client.connect().then(() => {
  db = client.db("apiUol");
});

const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().required(),
});

const app = express();

app.use(cors());
app.use(express.json());

setInterval(async () => {

  const participantes = await db.collection("participants").find().toArray()

  for (let i = 0; i < participantes.length; i++){
    if (participantes[i].lastStatus + 10000 < Date.now()){
      await db.collection("participants").deleteOne({name: participantes[i].name})

      let message = {from: participantes[i].name, to: 'Todos', text: 'sai da sala...', type: 'status', time: `${dayjs().$H}:${dayjs().$m}:${dayjs().$s}`}

      await db.collection("messages").insertOne(message);
    }
  }
}, 15000)

app.post("/participants", async (request, response) => {
  const { name } = request.body;

  const validou = participantSchema.validate(request.body);

  if (validou.error) {
    const messages = validou.error.details.map((item) => item.message);
    response.status(422).send(messages);
    return false;
  }

  const participantesAtivos = await db
    .collection("participants")
    .find()
    .toArray();

  for (let i = 0; i < participantesAtivos.length; i++) {
    if (participantesAtivos[i].name === name) {
      response.status(409).send();
      return false;
    }
  }

  let participant = {
    name,
    lastStatus: Date.now(),
  };

  let message = {
    from: participant.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: `${dayjs().$H}:${dayjs().$m}:${dayjs().$s}`,
  };

  try {
    await db.collection("participants").insertOne(participant);
    await db.collection("messages").insertOne(message);

    response.status(201).send();
  } catch (error) {
    response.status(500).send();
  }
});

app.get("/participants", async (request, response) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    response.send(participants);
  } catch (error) {
    response.status(500).send();
  }
});

app.post("/messages", async (request, response) => {
  const { to, text, type } = request.body;
  const user = request.headers.user;

  const validou = messageSchema.validate({ to, text, type });

  if (validou.error) {
    response.status(422).send();
    return false;
  }

  const participantesAtivos = await db
    .collection("participants")
    .find()
    .toArray();

  let from = "";
  let participanteEncontrado = false;

  for (let i = 0; i < participantesAtivos.length; i++) {
    if (participantesAtivos[i].name === user) {
      from = user;
      participanteEncontrado = true;
    }
  }

  if ((participanteEncontrado = false)) {
    response.status(422).send();
    return false;
  }

  if (type !== "message" && type !== "private_message") {
    response.status(422).send();
    return false;
  }

  const message = {
    from,
    to,
    text,
    type,
    time: `${dayjs().$H}:${dayjs().$m}:${dayjs().$s}`,
  };

  try {
    await db.collection("messages").insertOne(message);
    response.status(201).send();
  } catch (error) {
    response.status(500).send();
  }
});

app.get("/messages", async (request, response) => {
  const limit = parseInt(request.query.limit);
  const user = request.headers.user;

  try {
    const messages = await db
      .collection("messages")
      .find({
        $or: [
          { type: "message" },
          { type: "status" },
          { to: user },
          { from: user },
        ],
      })
      .toArray();

    if (limit === undefined) {
      response.send(messages);
    } else {
      response.send(messages.slice(`-${limit}`));
    }
  } catch (error) {
    response.status(500).send();
  }
});

app.post("/status", async (request, response) => {
  const user = request.headers.user;

  const participantesAtivos = await db
    .collection("participants")
    .find()
    .toArray();

  let participanteEncontrado = false;

  for (let i = 0; i < participantesAtivos.length; i++) {
    if (participantesAtivos[i].name === user) {
      participanteEncontrado = true;
    }
  }

  if ((participanteEncontrado = false)) {
    response.status(404).send();
    return false;
  }

  await db
    .collection("participants")
    .updateOne({name: user},{$set: {lastStatus: Date.now()}});

  response.status(200).send()
});

app.listen(5000);
