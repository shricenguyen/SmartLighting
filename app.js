const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const LightData = require("./model/lightData");
const mqtt = require("mqtt");

const app = express();
const port = 3000;

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://amborse31:hoanhuy31@controller.2ifhcyb.mongodb.net/?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Connect to MQTT broker
const mqttOptions = {
  host: "73297ed6e27145b899008fecf94238c9.s1.eu.hivemq.cloud",
  port: 8883,
  protocol: "mqtts",
  username: "amborse31",
  password: "Cdfkd2pm!",
};
const mqttClient = mqtt.connect(mqttOptions);

mqttClient.on("error", (err) => {
  console.error("Connection error: ", err);
});

// Subscribe to the lightbulb topic
function subscribeToLightbulbTopic() {
  //using for loop to subscribe to the lightbulb topic with each lightID
  const lightIDs = ["bulb1", "bulb2", "bulb3"];
  lightIDs.forEach((lightID) => {
    const topic = "lightbulb/" + lightID + "/status";
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error("Error subscribing to topic " + topic, err);
      } else {
        console.log("Subscribed to topic " + topic);
      }
    });
  });
}

// Publish to the lightbulb topic
function publishToLightbulbTopic(topic, message) {
  mqttClient.publish(topic, message, (err) => {
    if (err) {
      console.error(
        "Error publishing message " + message + " to topic " + topic
      );
    } else {
      console.log("Published message " + message + " to topic " + topic);
    }
  });
}

//update the light status in the database when receiving a message from the lightbulb topic
function updateLightStatus(lightID, lightStatus, toggleTime) {
  console.log(
    "Received message from lightbulb topic: lightbulb/" + lightID + "/status"
  );
  console.log("Message payload: " + lightStatus + " at " + toggleTime);
}

// Parse JSON bodies (as sent by API clients)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//serve static files
app.use(express.static("public"));

//initiallisng light system

async function initialiseLightSystem() {
  try {
    // Check if there is any light data in the database
    const existingLightData = await LightData.find({
      lightID: { $in: ["bulb1", "bulb2", "bulb3"] },
    });

    // If there is no light data in the database, create a new light data object
    if (existingLightData.length === 0) {
      // Create new light data objects
      const light1Data = new LightData({
        lightID: "bulb1",
        lightStatus: false,
        toggleTime: new Date(),
      });
      await light1Data.save();

      const light2Data = new LightData({
        lightID: "bulb2",
        lightStatus: false,
        toggleTime: new Date(),
      });
      await light2Data.save();

      const light3Data = new LightData({
        lightID: "bulb3",
        lightStatus: false,
        toggleTime: new Date(),
      });
      await light3Data.save();

      console.log("Light system initialised");
    } else {
      console.log("Light system already initialised");
    }
  } catch (err) {
    console.error("Error initialising light system", err);
  }
}

initialiseLightSystem();

// GET method route
app.get("/api/lightbulb", async (req, res) => {
  try {
    const latestToggle = await LightData.findOne().sort({ toggleTime: -1 });

    if (latestToggle) {
      res.json({
        lightID: latestToggle.lightID,
        lightStatus: latestToggle.lightStatus,
        toggleTime: latestToggle.toggleTime,
      });
    } else {
      res.json({ message: "No light data found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST method route
app.post("/api/lightbulb", async (req, res) => {
  try {
    const { lightID, lightStatus } = req.body;
    console.log(
      "Received POST request for lightID: " +
        lightID +
        " with lightStatus: " +
        lightStatus
    );

    // Publish the light status to the MQTT broker
    const topic = "lightbulb/" + lightID + "/status";
    publishToLightbulbTopic(topic, lightStatus.toString());

    //checking the existing light data
    const existingLightData = await LightData.findOne({ lightID });

    //if there is no existing light data, create a new light data object
    if (!existingLightData) {
      // Create a new light data object
      const lightData = new LightData({
        lightID,
        lightStatus,
        toggleTime: new Date(),
      });
      // Save the light data object to the database
      await lightData.save();

      console.log("Updated light " + lightID + " to status " + lightStatus);
    } else {
      //change the light status and update the toggle time
      existingLightData.lightStatus = !existingLightData.lightStatus;
      existingLightData.toggleTime = new Date();
      //save the light data object to the database
      await existingLightData.save();
      console.log(
        "Updated light " +
          existingLightData.lightID +
          " to status " +
          existingLightData.lightStatus +
          " at " +
          existingLightData.toggleTime
      );

      //checking the boolean value of light status and return the message
      if (existingLightData.lightStatus) {
        console.log("Light " + lightID + " is on");
        console.log("");
      } else {
        console.log("Light " + lightID + " is off");
        console.log("");
      }

      res.json({ message: "Light data saved" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//subscribe to the lightbulb topic
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  subscribeToLightbulbTopic();
});

//handle the message received from the lightbulb topic
mqttClient.on("message", (topic, message) => {
  const lightID = topic.split("/")[1];
  const lightStatus = message.toString();
  const toggleTime = new Date();

  updateLightStatus(lightID, lightStatus, toggleTime);
});

app.listen(port, () => {
  console.log(`server listening at http://localhost:${port}`);
});
