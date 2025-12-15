const mongoose = require("mongoose")

const reelSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    caption:{
        type:String
    },
    mediaUrl:{
        type:String,
        required:true
    },
    thumnnailUrl:{
        type:String
    },
    duration:{
        type:Number
    },
},{timestamps:true})
module.exports = mongoose.model("Reel",reelSchema)