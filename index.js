const mongoose = require("mongoose")
const path = require("node:path")
const express = require("express")
const cors = require("cors")
require("dotenv").config()
const helmet = require("helmet")

const authApi = require("./routes/auth.route")

const app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
  }),
)

app.use("/uploads", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173")
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Range, Content-Type")
  res.header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }

  next()
})

app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use("/api/auth", authApi)
app.use("/api/reel", require("./routes/reel.route"))

app.use((req, res) => {
  res.status(404).json({ message: "Resource Not Found" })
})

app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).json({ message: "Something Went Wrong", error: err.message })
})

mongoose.connect(process.env.MONGO_URL)
mongoose.connection.once("open", () => {
  console.log("MONGO CONNECTED")
  app.listen(process.env.PORT, console.log("SERVER RUNNING"))
})
