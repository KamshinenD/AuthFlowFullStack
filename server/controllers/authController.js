const User = require("../models/User");
const Token = require("../models/Token");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const {
  attachCookiesToResponse,
  createTokenUser,
  sendVerificationEmail,
  sendVerificationSuccessEmail,
  sendResetPasswordEmail,
  createHash
} = require("../utils");
const crypto = require("crypto");

const origin = "http://localhost:3000";

const register = async (req, res) => {
  const { email, name, password } = req.body;

  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new CustomError.BadRequestError("Email already exists");
  }

  // first registered user is an admin
  const isFirstAccount = (await User.countDocuments()) === 0;
  const role = isFirstAccount ? "admin" : "user";
  const verificationToken = crypto.randomBytes(40).toString("hex");
  const user = await User.create({
    name,
    email,
    password,
    role,
    verificationToken,
  });
  // const origin = "http://localhost:3000";
  await sendVerificationEmail({
    name: user.name,
    email: user.email,
    verificationToken: user.verificationToken,
    origin,
  });
  //send verification token only while testing on postman;
  res
    .status(StatusCodes.CREATED)
    .json({ msg: "success! please check your mail to verify account" });
};

const verifyEmail = async (req, res) => {
  const { verificationToken, email } = req.body;
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new CustomError.UnauthenticatedError("Email not registered");
  }
  if (user.verificationToken === "") {
    throw new CustomError.UnauthenticatedError("user verified already");
  }
  if (verificationToken !== user.verificationToken) {
    throw new CustomError.UnauthenticatedError("Invalid token provided");
  }

  user.isVerified = true;
  user.verified = Date.now();
  user.verificationToken = "";
  user.save();
  await sendVerificationSuccessEmail({
    name: user.name,
    email: user.email,
  });
  res.status(StatusCodes.OK).json({ msg: "Email verification succesful" });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new CustomError.BadRequestError("Please provide email and password");
  }
  const user = await User.findOne({ email });

  if (!user) {
    throw new CustomError.UnauthenticatedError("Invalid Credentials");
  }
  if (!user.isVerified) {
    throw new CustomError.UnauthenticatedError("Account not verified");
  }
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new CustomError.UnauthenticatedError("Invalid Credentials");
  }
  const tokenUser = createTokenUser(user);
  //create refresh token
  let refreshToken = "";

  // check for existing token
  const existingToken = await Token.findOne({ user: user._id });

  if (existingToken) {
    const { isValid } = existingToken;
    if (!isValid) {
      throw new CustomError.UnauthenticatedError("Invalid Credentials");
    }
    refreshToken = existingToken.refreshToken;
    attachCookiesToResponse({ res, user: tokenUser, refreshToken });

    res.status(StatusCodes.OK).json({ user: tokenUser });
    return;
  }

  refreshToken = crypto.randomBytes(40).toString("hex");
  const userAgent = req.headers["user-agent"];
  const ip = req.ip;

  const userToken = { refreshToken, ip, userAgent, user: user._id };
  await Token.create(userToken);
  attachCookiesToResponse({ res, user: tokenUser, refreshToken });

  res.status(StatusCodes.OK).json({ user: tokenUser });
};

const logout = async (req, res) => {
  await Token.findOneAndDelete({ user: req.user.userId });
  res.cookie("accessToken", "logout", {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.cookie("refreshToken", "logout", {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.status(StatusCodes.OK).json({ msg: "user logged out!" });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new CustomError.BadRequestError("Please provide valid email");
  }
  const user = await User.findOne({ email: email });
  if (user) {
    // throw new CustomError.BadRequestError("No user found with this email");
    const passwordToken = crypto.randomBytes(70).toString("hex");
    // send email
    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      token: passwordToken,
      origin: origin,
    });
    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);
    user.passwordToken = passwordToken;
    user.passwordTokenExpirationDate = passwordTokenExpirationDate;
    await user.save();
  }
  res
    .status(StatusCodes.OK)
    .json({ msg: "please check your email for reset password link" });
};

const resetPassword = async (req, res) => {
  const {token, email, password}= req.body;
  if(!token ||!email ||!password){
    throw new CustomError.BadRequestError("Please provide all values")
  };
  const user= await User.findOne({email});
  if(user){
    // throw new CustomError.NotFoundError("No user found with this email")

    const currentDate= new Date();

    if (user.passwordTokenExpirationDate < currentDate) {
      throw new CustomError.UnauthorizedError("Verification token has expired");
    }

    if(user.passwordToken===token && user.passwordTokenExpirationDate>currentDate){
      user.password=password;
      user.passwordToken=null;
      user.passwordTokenExpirationDate=null;
      await user.save();
    }
  }
  res.send("password changed succesfully");
};

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
