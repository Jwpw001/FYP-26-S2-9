const verifyToken = (req,res,next)=>{

    console.log("Token checked");

    next();

};

module.exports=verifyToken;