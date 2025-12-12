const bcrypt = require("bcrypt")
const asyncHandler = require("express-async-handler")
const user = require("../models/auth")

exports.getAllUser = asyncHandler(async(req,res)=>{
    const result = await user.find()
    res.status(200).json({message:"Fetch Successfully",result})
})
exports.registerUser = asyncHandler(async(req,res)=>{
    const {name,email,password} = req.body

    if (!name,!email,!password){
        return res.status(400).json({message:"All Field Required"})
    }

    const found = await user.findOne({email})
    if (found){
        return res.status(409).json({message:"Email Already Registered"})
    }
    const hash = await bcrypt.hash(password,10)

    const result = await user.create({name,email,password:hash})
    res.status(201).json({
        message:"User Create Successfull",
        user:result
    })
})

exports.loginUser = asyncHandler(async(req,res)=>{
    const {email,password} = req.body

    if (!email || !password){
        return res.status(400).json({message:"Credential Not Found"})
    }

    const found = await user.findOne({email})
    const verify = found && await bcrypt.compare(password,found.password)

    if (!found || !verify){
        return res.status(401).json({message:"Invalid Credential"})
    }

    const userData = {
        _id : found._id,
        name : found.name,
        email : found.email
    };

    res.status(200).json({
        message:"Login Successfull",
        userData
    })
})