const mongoose = require("mongoose")
const express = require("express")
const cors = require("cors")
require("dotenv").config()

const authApi = require("./routes/auth.route")

const app = express()

app.use(express.json())


app.use("/api/auth",authApi)
app.use("/api/product",productApi)

app.use((req,res)=>{
    res.status(404).json({message:"Resource Not Found"})
})

app.use((err,req,res,next)=>{
    console.log(err);
    res.status(500).json({message:"Something Went Wrong",error:err.message})
    
})

mongoose.connect(process.env.MONGO_URL)
mongoose.connection.once("open",()=>{
    console.log("MONGO CONNECTED");
    app.listen(process.env.PORT,console.log("SERVER RUNNING"))
    
})